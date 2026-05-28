'use strict';

/**
 * Structured logger with GitHub Actions annotation support.
 *
 * In CI (GITHUB_ACTIONS=true) warnings and errors are emitted as workflow
 * annotations (`::warning::`, `::error::`) and grouped output uses
 * `::group::`/`::endgroup::`. Locally it falls back to plain prefixed lines.
 * Streams are injectable so behavior can be asserted in tests.
 */

function createLogger({
  out = process.stdout,
  err = process.stderr,
  github = String(process.env.GITHUB_ACTIONS) === 'true',
  prefix = '',
} = {}) {
  const tag = prefix ? `${prefix} ` : '';

  const write = (stream, line) => stream.write(`${line}\n`);

  return {
    github,
    info(message) {
      write(out, `${tag}${message}`);
    },
    warn(message) {
      write(err, github ? `::warning::${tag}${message}` : `${tag}WARN: ${message}`);
    },
    error(message) {
      write(err, github ? `::error::${tag}${message}` : `${tag}ERROR: ${message}`);
    },
    group(title) {
      write(out, github ? `::group::${tag}${title}` : `\n=== ${tag}${title} ===`);
    },
    groupEnd() {
      if (github) write(out, '::endgroup::');
    },
  };
}

module.exports = { createLogger };
