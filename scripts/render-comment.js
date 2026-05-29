#!/usr/bin/env node
'use strict';

/**
 * Job C — PR comment renderer (finding M2).
 *
 * Builds the consolidated enrichment-preview comment. Every user-controlled
 * field (skill name, category, owner) is passed through stripMarkdown so a
 * hostile value like `[Click here](https://lookalike.com/login)` cannot become
 * a phishing link inside an authoritative-looking bot comment. URLs are only
 * rendered as links when they parse as https on an allow-listed host
 * (safeLink); otherwise the label is shown as plain text.
 *
 * Usage:
 *   node scripts/render-comment.js enriched/a.json [enriched/b.json ...]
 *   (prints the markdown body to stdout)
 */

const fs = require('fs');

const { stripMarkdown, safeLink } = require('./lib/sanitize');

function verdictOf(result) {
  return result && typeof result === 'object' && typeof result.verdict === 'string'
    ? result.verdict
    : 'failed';
}

/**
 * Renders a scanner cell: "<verdict> ([report](url))" when the report URL is a
 * safe link, otherwise just the verdict. The label "report" is static, never
 * user-controlled.
 */
function scannerCell(result, reportUrl) {
  const verdict = stripMarkdown(verdictOf(result));
  const link = safeLink(reportUrl);
  return link ? `${verdict} ([report](${link}))` : verdict;
}

function rowFor(skill) {
  const name = stripMarkdown(skill.name) || stripMarkdown(skill.skill_id) || 'unknown';
  const repoLink = safeLink(skill.github_url);
  const nameCell = repoLink ? `[${name}](${repoLink})` : name;

  const category = stripMarkdown((skill.category || []).join(', '));
  const ownerName = stripMarkdown(skill.owner && skill.owner.username);
  const ownerLink = safeLink(skill.owner && skill.owner.profile_url);
  const ownerCell = ownerLink ? `[${ownerName}](${ownerLink})` : ownerName;
  const commit = stripMarkdown((skill.latest_commit || 'n/a').slice(0, 7));

  const agentguard = scannerCell(skill.agentguard_result, skill.agentguard_report_url);

  return `| ${nameCell} | ${category} | ${ownerCell} | \`${commit}\` | ${agentguard} |`;
}

/**
 * @param {object[]} skills enriched metadata objects
 * @returns {string} markdown comment body
 */
function renderComment(skills) {
  const list = Array.isArray(skills) ? skills : [];
  const rows = list.map(rowFor);

  return [
    '## Skill Enrichment Preview',
    '',
    'Each skill below was scanned by AgentGuard. Merge is blocked unless the',
    'verdict is `passed`.',
    '',
    '| Skill | Category | Owner | Commit | AgentGuard |',
    '|-------|----------|-------|--------|------------|',
    ...rows,
  ].join('\n');
}

module.exports = { renderComment, scannerCell };

if (require.main === module) {
  const skills = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
  process.stdout.write(`${renderComment(skills)}\n`);
}
