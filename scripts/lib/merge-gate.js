'use strict';

/**
 * Merge-gate decision logic (finding C3).
 *
 * The `merge-gate` status check is the security boundary that branch protection
 * enforces. It is `success` ONLY when the AgentGuard verdict recorded in the
 * enriched metadata is `passed`. A failed, warning, missing, or malformed
 * verdict yields `failure` (fail closed) so that scanner outages or poisoned
 * responses can never produce a green gate.
 */

const SUCCESS = 'success';
const FAILURE = 'failure';

/**
 * @param {object} metadata enriched skill metadata
 * @returns {{ state: 'success'|'failure', verdict: (string|null), reason: string }}
 */
function evaluateMergeGate(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { state: FAILURE, verdict: null, reason: 'metadata-missing' };
  }

  const result = metadata.agentguard_result;
  if (!result || typeof result !== 'object') {
    return { state: FAILURE, verdict: null, reason: 'no-agentguard-result' };
  }

  const verdict = typeof result.verdict === 'string' ? result.verdict : null;
  if (verdict === 'passed') {
    return { state: SUCCESS, verdict, reason: 'agentguard-passed' };
  }

  return { state: FAILURE, verdict, reason: `agentguard-verdict-${verdict ?? 'missing'}` };
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
