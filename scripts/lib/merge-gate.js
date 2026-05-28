'use strict';

/**
 * Merge-gate decision logic (finding C3).
 *
 * The `merge-gate` status check is the security boundary that branch protection
 * enforces. It is `success` ONLY when BOTH independent scanners -- AgentGuard
 * and HashDit -- recorded a `passed` verdict in the enriched metadata. Any
 * failed, warning, missing, or malformed verdict from either scanner yields
 * `failure` (fail closed) so that a scanner outage or a poisoned response can
 * never produce a green gate. Requiring both scanners means a single
 * compromised scanner cannot wave a malicious skill through on its own.
 */

const SUCCESS = 'success';
const FAILURE = 'failure';

// Each scanner records its verdict under `<scanner>_result.verdict`.
const REQUIRED_SCANNERS = [
  { key: 'agentguard_result', name: 'agentguard' },
  { key: 'hashdit_result', name: 'hashdit' },
];

/**
 * @param {object} metadata enriched skill metadata
 * @returns {{ state: 'success'|'failure', verdicts: object, reason: string }}
 */
function evaluateMergeGate(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { state: FAILURE, verdicts: {}, reason: 'metadata-missing' };
  }

  const verdicts = {};

  for (const scanner of REQUIRED_SCANNERS) {
    const result = metadata[scanner.key];
    if (!result || typeof result !== 'object') {
      return { state: FAILURE, verdicts, reason: `no-${scanner.name}-result` };
    }

    const verdict = typeof result.verdict === 'string' ? result.verdict : null;
    verdicts[scanner.name] = verdict;

    if (verdict !== 'passed') {
      return { state: FAILURE, verdicts, reason: `${scanner.name}-verdict-${verdict ?? 'missing'}` };
    }
  }

  return { state: SUCCESS, verdicts, reason: 'all-scanners-passed' };
}

/**
 * Evaluates a batch of metadata objects. The gate passes only if every skill
 * passes.
 * @param {object[]} metadataList
 */
function evaluateBatch(metadataList) {
  const items = Array.isArray(metadataList) ? metadataList : [];
  const results = items.map((m) => evaluateMergeGate(m));
  const failures = results.filter((r) => r.state === FAILURE);
  return {
    state: failures.length === 0 && results.length > 0 ? SUCCESS : FAILURE,
    results,
    failureCount: failures.length,
  };
}

module.exports = { evaluateMergeGate, evaluateBatch, SUCCESS, FAILURE };
