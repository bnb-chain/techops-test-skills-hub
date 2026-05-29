#!/usr/bin/env node
'use strict';

/**
 * Job B — enrich (privileged; runs ONLY from main-branch code, with secrets).
 *
 * Consumes the data-only artifact produced by Job A (parse-pr) -- never the
 * PR's copy of this script -- and enriches it with live GitHub metadata plus
 * an AgentGuard security scan. Treating the PR JSON as data, not code, is the
 * core fix for finding C1.
 *
 * Hardening applied here:
 *   - GitHub URL parsed with the WHATWG URL parser (M5, via parse-url).
 *   - All network calls go through fetchWithRetry: timeouts + backoff (M1, M6).
 *   - Scanner candidate set broadened beyond .md with byte caps (H2, M1).
 *   - The scanner response is schema-validated and FAILS CLOSED (M4): any
 *     error yields verdict `failed`, never `null`.
 *
 * Usage:
 *   node scripts/enrich-skill.js parsed/my-skill.json [parsed/other.json ...]
 *
 * Env:
 *   GITHUB_TOKEN, AGENTGUARD_API_KEY
 *   ENRICHED_DIR  - output directory (default: "enriched")
 */

const fs = require('fs');
const path = require('path');

const { createLogger } = require('./lib/logger');
const { fetchWithRetry } = require('./lib/http');
const { parseGithubUrl } = require('./lib/parse-url');
const { selectCandidatePaths, buildScanContent } = require('./lib/content');
const agentguard = require('./lib/agentguard');

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'skills-hub-enricher',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubGet(url, { fetchImpl, token, httpOptions }) {
  const res = await fetchWithRetry(url, {
    fetchImpl,
    ...httpOptions,
    init: { headers: githubHeaders(token) },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status} for ${url}`);
  }
  return res.json();
}

/**
 * Fetches scannable repo files (best effort). A failure to list or fetch files
 * is NOT fatal -- it simply yields no content, which makes the scanners fail
 * closed downstream rather than silently passing.
 */
async function fetchRepoFiles(owner, repo, branch, { fetchImpl, token, httpOptions, logger }) {
  let tree;
  try {
    tree = await githubGet(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { fetchImpl, token, httpOptions },
    );
  } catch (err) {
    logger.warn?.(`Could not list repo tree: ${err.message}`);
    return [];
  }

  const paths = selectCandidatePaths(tree.tree || []);
  const files = [];
  for (const p of paths) {
    try {
      const raw = await fetchWithRetry(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`,
        { fetchImpl, ...httpOptions, init: { headers: { 'User-Agent': 'skills-hub-enricher' } } },
      );
      if (raw.ok) files.push({ path: p, text: await raw.text() });
    } catch (err) {
      logger.warn?.(`Could not fetch ${p}: ${err.message}`);
    }
  }
  return files;
}

/**
 * Enriches one parsed submission. Pure with respect to the injected fetchImpl,
 * logger and clock, so it is fully testable without network access.
 *
 * @param {object} args
 * @param {object} args.parsed data-only artifact from Job A
 * @returns {Promise<object>} enriched metadata
 */
async function enrichSkill({
  parsed,
  githubToken,
  agentguardKey,
  fetchImpl = globalThis.fetch,
  logger = console,
  httpOptions = {},
  now = () => new Date().toISOString(),
}) {
  const { owner, repo, canonical } = parseGithubUrl(parsed.github_url);

  logger.info?.(`Checking repo accessibility: ${canonical}`);
  const repoData = await githubGet(`https://api.github.com/repos/${owner}/${repo}`, { fetchImpl, token: githubToken, httpOptions });

  logger.info?.(`Fetching owner profile: ${owner}`);
  const ownerData = await githubGet(`https://api.github.com/users/${owner}`, { fetchImpl, token: githubToken, httpOptions });

  logger.info?.('Fetching latest commit');
  const commits = await githubGet(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
    { fetchImpl, token: githubToken, httpOptions },
  );
  const latestCommit = Array.isArray(commits) && commits[0] ? commits[0].sha ?? null : null;

  logger.info?.('Gathering repo content for scanners');
  const files = await fetchRepoFiles(owner, repo, repoData.default_branch, { fetchImpl, token: githubToken, httpOptions, logger });
  const payload = buildScanContent(files);

  logger.info?.('Running AgentGuard scan');
  const ag = await agentguard.scan({ payload, apiKey: agentguardKey, fetchImpl, logger, httpOptions });

  return {
    name: parsed.name || parsed.skill_id,
    github_url: canonical,
    category: parsed.category,
    description: parsed.description,
    owner: {
      username: ownerData.login,
      display_name: ownerData.name ?? ownerData.login,
      type: ownerData.type,
      profile_url: `https://github.com/${ownerData.login}`,
      avatar_url: ownerData.avatar_url ?? null,
    },
    repo: {
      stars: repoData.stargazers_count ?? null,
      default_branch: repoData.default_branch,
    },
    latest_commit: latestCommit,
    agentguard_scan_id: ag.scan_id,
    agentguard_report_url: ag.report_url,
    agentguard_result: ag.result,
    evaluated_at: now(),
  };
}

async function run(argv, { logger, enrichedDir, env }) {
  if (argv.length === 0) {
    logger.error('Usage: node scripts/enrich-skill.js <parsed-artifact.json> [...]');
    return 1;
  }

  fs.mkdirSync(enrichedDir, { recursive: true });

  let hadError = false;

  for (const fileName of argv) {
    logger.group(`Enriching ${fileName}`);
    try {
      const parsed = JSON.parse(fs.readFileSync(fileName, 'utf8'));
      const enriched = await enrichSkill({
        parsed,
        githubToken: env.GITHUB_TOKEN,
        agentguardKey: env.AGENTGUARD_API_KEY,
        logger,
      });
      const skillId = parsed.skill_id || path.basename(fileName, '.json');
      const outPath = path.join(enrichedDir, `${skillId}.json`);
      fs.writeFileSync(outPath, `${JSON.stringify(enriched, null, 2)}\n`);
      logger.info(`Wrote ${outPath}`);
    } catch (err) {
      logger.error(`Failed to enrich ${fileName}: ${err.message}`);
      hadError = true;
    }
    logger.groupEnd();
  }

  return hadError ? 1 : 0;
}

module.exports = { enrichSkill, githubGet, fetchRepoFiles, run };

if (require.main === module) {
  const logger = createLogger({ prefix: '[enrich]' });
  const enrichedDir = process.env.ENRICHED_DIR || 'enriched';
  run(process.argv.slice(2), { logger, enrichedDir, env: process.env }).then((code) => process.exit(code));
}
