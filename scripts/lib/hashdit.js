'use strict';

/**
 * HashDit scanner client (findings M1, M4, M6).
 *
 * Second, independent scanner alongside AgentGuard. Same security posture:
 * FAIL CLOSED. Any condition that prevents us from obtaining a trustworthy
 * `passed` verdict -- missing API key, oversize content, network timeout,
 * non-2xx response, or a response that fails schema validation -- is recorded
 * as a `failed` verdict, never `null`. The merge-gate requires BOTH scanners to
 * return `passed`, so a HashDit failure alone blocks the merge.
 */

const path = require('path');
const Ajv = require('ajv');

const { fetchWithRetry } = require('./http');

const responseSchema = require(path.join(__dirname, '..', '..', 'schemas', 'hashdit-response.v1.json'));

const ajv = new Ajv({ allErrors: true, removeAdditional: true });
const validateResponse = ajv.compile(responseSchema);

const DEFAULT_BASE_URL = 'https://api.hashdit.io';

function failed(reason, extra = {}) {
  return {
    status: 'failed',
    reason,
    scan_id: null,
    report_url: null,
    result: {
      risk_score: null,
      risk_level: null,
      verdict: 'failed',
      summary: null,
      threats: [],
    },
    ...extra,
  };
}

/**
 * @param {object} args
 * @param {{ ok:boolean, reason:(string|null), content:string }} args.payload result of buildScanContent
 * @param {string} args.apiKey
 * @param {string} [args.baseUrl]
 * @param {Function} [args.fetchImpl]
 * @param {object} [args.logger]
 * @param {object} [args.httpOptions]
 */
async function scan({
  payload,
  apiKey,
  baseUrl = process.env.HASHDIT_BASE || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  logger = console,
  httpOptions = {},
}) {
  if (!apiKey) {
    logger.warn?.('HashDit API key not set; recording scan as failed (fail closed).');
    return failed('missing-api-key');
  }

  if (!payload || payload.ok !== true || !payload.content) {
    const reason = payload && payload.reason ? payload.reason : 'no-scannable-content';
    logger.warn?.(`HashDit scan not run (${reason}); recording as failed (fail closed).`);
    return failed(reason);
  }

  let response;
  try {
    response = await fetchWithRetry(`${baseUrl}/api/v1/scan`, {
      fetchImpl,
      ...httpOptions,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ content: payload.content }),
      },
    });
  } catch (err) {
    logger.error?.(`HashDit request failed: ${err.message}; recording as failed (fail closed).`);
    return failed(`request-error:${err.message}`);
  }

  if (!response.ok) {
    logger.error?.(`HashDit returned HTTP ${response.status}; recording as failed (fail closed).`);
    return failed(`http-${response.status}`);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    logger.error?.(`HashDit response was not valid JSON: ${err.message}; failing closed.`);
    return failed('invalid-json');
  }

  const data = body && typeof body === 'object' ? body.data : undefined;
  if (!data || typeof data !== 'object') {
    logger.error?.('HashDit response missing `data` envelope; failing closed.');
    return failed('missing-data-envelope');
  }

  if (!validateResponse(data)) {
    const detail = (validateResponse.errors || [])
      .map((e) => `${e.instancePath || '/'} ${e.message}`)
      .join('; ');
    logger.error?.(`HashDit response failed schema validation (${detail}); failing closed.`);
    return failed('schema-validation-failed');
  }

  // `data` has been normalized by ajv (unknown fields stripped, verdict enum-checked).
  const passed = data.verdict === 'passed';
  return {
    status: passed ? 'passed' : 'failed',
    reason: passed ? null : `verdict-${data.verdict}`,
    scan_id: data.scanId ?? null,
    report_url: data.reportUrl ?? null,
    result: {
      risk_score: data.riskScore ?? null,
      risk_level: data.riskLevel ?? null,
      verdict: passed ? 'passed' : 'failed',
      summary: data.summary ?? null,
      threats: data.threats ?? [],
    },
  };
}

module.exports = { scan, DEFAULT_BASE_URL };
