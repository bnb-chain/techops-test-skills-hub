'use strict';

/**
 * Hardened GitHub URL parsing (finding M5).
 *
 * Uses the WHATWG URL parser instead of a permissive regex so that lookalike
 * hosts such as `https://github.com.evil.com/owner/repo` are rejected rather
 * than silently accepted. Returns a canonical, safe-to-display URL.
 */

const ALLOWED_HOST = 'github.com';

function parseGithubUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('github_url must be a non-empty string');
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`github_url is not a valid URL: ${input}`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`github_url must use https: ${input}`);
  }

  if (url.hostname !== ALLOWED_HOST) {
    throw new Error(`github_url host must be exactly ${ALLOWED_HOST}: got "${url.hostname}"`);
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`github_url must include owner and repo: ${input}`);
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');

  const validSegment = /^[A-Za-z0-9._-]+$/;
  if (!validSegment.test(owner) || !validSegment.test(repo)) {
    throw new Error(`github_url owner/repo contain invalid characters: ${input}`);
  }

  return {
    owner,
    repo,
    canonical: `https://${ALLOWED_HOST}/${owner}/${repo}`,
  };
}

module.exports = { parseGithubUrl, ALLOWED_HOST };
