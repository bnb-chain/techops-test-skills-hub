#!/usr/bin/env node
'use strict';

/**
 * Job A — parse-pr (low privilege, runs PR-checked-out code; NO secrets).
 *
 * Reads each contributor-submitted skills/<name>-metadata.json, validates it
 * against the strict v1 schema, canonicalizes the github_url, and emits a
 * data-only artifact (parsed/<skill_id>.json). The privileged enrich job
 * consumes that artifact instead of re-reading PR code, so PR-supplied code
 * never runs with secrets (finding C1).
 *
 * The artifact contains ONLY plain data: { skill_id, name, github_url,
 * category, description }. No code, no tokens.
 *
 * Usage:
 *   node scripts/parse-submission.js skills/a-metadata.json [skills/b-metadata.json ...]
 *
 * Env:
 *   PARSED_DIR  - output directory for artifacts (default: "parsed")
 */

const fs = require('fs');
const path = require('path');

const { createLogger } = require('./lib/logger');
const { parseAndValidateStrict } = require('./lib/metadata');
const { parseGithubUrl } = require('./lib/parse-url');

function skillIdFromFileName(fileName) {
  return path.basename(fileName).replace(/-metadata\.json$/, '');
}

/**
 * Pure parse + validate of a single submission. No filesystem writes.
 * @returns {{ ok:boolean, skillId:string, artifact:(object|null), errors:string[] }}
 */
function parseSubmission({ raw, fileName, logger = console }) {
  const skillId = skillIdFromFileName(fileName);

  const { valid, errors, data } = parseAndValidateStrict(raw);
  if (!valid) {
    logger.error?.(`Schema validation failed for ${fileName}: ${errors.join('; ')}`);
    return { ok: false, skillId, artifact: null, errors };
  }

  let canonicalUrl;
  try {
    canonicalUrl = parseGithubUrl(data.github_url).canonical;
  } catch (err) {
    logger.error?.(`Invalid github_url in ${fileName}: ${err.message}`);
    return { ok: false, skillId, artifact: null, errors: [err.message] };
  }

  const artifact = {
    skill_id: skillId,
    name: typeof data.name === 'string' && data.name.trim() !== '' ? data.name : skillId,
    github_url: canonicalUrl,
    category: data.category,
    description: data.description,
  };

  return { ok: true, skillId, artifact, errors: [] };
}

function run(argv, { logger, parsedDir }) {
  if (argv.length === 0) {
    logger.error('Usage: node scripts/parse-submission.js <metadata.json> [...]');
    return 1;
  }

  fs.mkdirSync(parsedDir, { recursive: true });

  let hadError = false;

  for (const fileName of argv) {
    logger.group(`Parsing ${fileName}`);
    let raw;
    try {
      raw = fs.readFileSync(fileName, 'utf8');
    } catch (err) {
      logger.error(`Cannot read ${fileName}: ${err.message}`);
      hadError = true;
      logger.groupEnd();
      continue;
    }

    const result = parseSubmission({ raw, fileName, logger });
    if (!result.ok) {
      hadError = true;
      logger.groupEnd();
      continue;
    }

    const outPath = path.join(parsedDir, `${result.skillId}.json`);
    fs.writeFileSync(outPath, `${JSON.stringify(result.artifact, null, 2)}\n`);
    logger.info(`Wrote ${outPath}`);
    logger.groupEnd();
  }

  return hadError ? 1 : 0;
}

module.exports = { parseSubmission, skillIdFromFileName, run };

if (require.main === module) {
  const logger = createLogger({ prefix: '[parse-pr]' });
  const parsedDir = process.env.PARSED_DIR || 'parsed';
  process.exit(run(process.argv.slice(2), { logger, parsedDir }));
}
