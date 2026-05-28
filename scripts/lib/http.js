'use strict';

/**
 * HTTP client with timeouts and bounded retries (findings M1, M6).
 *
 * - Each attempt is wrapped in an AbortController so a slow-loris upstream can
 *   never stall the runner up to the 6-hour Actions limit.
 * - Transient failures (network error, HTTP 429, HTTP 5xx) are retried with
 *   exponential backoff. 4xx (other than 429) are returned immediately.
 * - `fetchImpl` and `sleep` are injectable so retry/backoff behavior is
 *   deterministically testable without real network or wall-clock delays.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BACKOFF_MS = 200;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetriableStatus(status) {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    sleep = defaultSleep,
    init = {},
  } = options;

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetchWithRetry: no fetch implementation available');
  }

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);

    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (isRetriableStatus(response.status) && attempt < retries) {
        lastError = new Error(`retriable HTTP status ${response.status} for ${url}`);
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < retries) {
        await sleep(backoffMs * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
  }

  // Unreachable: the final iteration always returns a response or throws.
  /* istanbul ignore next */
  throw lastError || new Error(`fetchWithRetry exhausted retries for ${url}`);
}

module.exports = {
  fetchWithRetry,
  isRetriableStatus,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRIES,
  DEFAULT_BACKOFF_MS,
};
