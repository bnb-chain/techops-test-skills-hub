#!/usr/bin/env node
'use strict';

/**
 * merge-gate status publisher (finding C3).
 *
 * Reads the enriched artifacts produced by Job B and exits 0 ONLY when every
 * skill passed the AgentGuard scan (see lib/merge-gate). A non-zero exit fails the
 * job, which fails the `merge-gate` status check that branch protection
 * requires -- so a failed or missing scan can never be merged. This is the
 * security boundary; a PR label cannot substitute for a green check here.
 *
 * Usage:
 *   node scripts/check-merge-gate.js enriched/a.json [enriched/b.json ...]
 */

const fs = require('fs');

const { createLogger } = require('./lib/logger');
const { evaluateBatch } = require('./lib/merge-gate');

/**
 * @returns {number} process exit code (0 = gate open, 1 = blocked)
 */
function run(argv, { logger = console, readFile = (p) => fs.readFileSync(p, 'utf8') } = {}) {
  if (!Array.isArray(argv) || argv.length === 0) {
    logger.error('merge-gate: no enriched artifacts supplied; failing closed.');
    return 1;
  }

  const metadataList = [];
  for (const filePath of argv) {
    let raw;
    try {
      raw = readFile(filePath);
    } catch (err) {
      logger.error(`merge-gate: cannot read ${filePath}: ${err.message}; failing closed.`);
      return 1;
    }
    try {
      metadataList.push(JSON.parse(raw));
    } catch (err) {
      logger.error(`merge-gate: ${filePath} is not valid JSON: ${err.message}; failing closed.`);
      return 1;
    }
  }

  const batch = evaluateBatch(metadataList);
  for (const result of batch.results) {
    logger.info(`merge-gate: ${result.state} (${result.reason})`);
  }

  if (batch.state === 'success') {
    logger.info(`merge-gate: PASS — ${metadataList.length} skill(s) cleared the scan.`);
    return 0;
  }

  logger.error(`merge-gate: BLOCKED — ${batch.failureCount} of ${metadataList.length} skill(s) failed.`);
  return 1;
}

module.exports = { run };

if (require.main === module) {
  const logger = createLogger({ prefix: '[merge-gate]' });
  process.exit(run(process.argv.slice(2), { logger }));
}
