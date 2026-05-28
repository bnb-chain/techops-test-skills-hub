'use strict';

/**
 * Output sanitization for PR comments (finding M2).
 *
 * User-controlled metadata fields (name, category, etc.) are rendered into an
 * authoritative-looking bot comment. Without escaping, a skill named
 * `[Click here](https://lookalike.com/login)` becomes a phishing link. We strip
 * Markdown metacharacters from display strings and only render links whose host
 * is on an allow-list.
 */

const DEFAULT_ALLOWED_HOSTS = ['github.com', 'agentguard.gopluslabs.io', 'hashdit.io'];

const MARKDOWN_METACHARS = /[[\]()|`*_~<>#!]/g;

function stripMarkdown(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(MARKDOWN_METACHARS, '')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Returns the URL string if it is an https URL on an allow-listed host,
 * otherwise null. Callers should render a plain label when null is returned.
 */
function safeLink(input, allowedHosts = DEFAULT_ALLOWED_HOSTS) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  let url;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!allowedHosts.includes(url.hostname)) return null;
  return url.toString();
}

module.exports = { stripMarkdown, safeLink, DEFAULT_ALLOWED_HOSTS };
