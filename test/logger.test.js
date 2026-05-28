'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createLogger } = require('../scripts/lib/logger');

function fakeStream() {
  const chunks = [];
  return { chunks, write: (s) => { chunks.push(s); return true; }, text: () => chunks.join('') };
}

test('emits GitHub Actions annotations when in CI', () => {
  const out = fakeStream();
  const err = fakeStream();
  const log = createLogger({ out, err, github: true });

  log.info('hello');
  log.warn('careful');
  log.error('boom');
  log.group('Processing');
  log.groupEnd();

  assert.equal(out.text().includes('hello\n'), true);
  assert.equal(err.text().includes('::warning::careful\n'), true);
  assert.equal(err.text().includes('::error::boom\n'), true);
  assert.equal(out.text().includes('::group::Processing\n'), true);
  assert.equal(out.text().includes('::endgroup::\n'), true);
});

test('falls back to plain prefixes outside CI', () => {
  const out = fakeStream();
  const err = fakeStream();
  const log = createLogger({ out, err, github: false });

  log.warn('careful');
  log.error('boom');

  assert.equal(err.text().includes('WARN: careful\n'), true);
  assert.equal(err.text().includes('ERROR: boom\n'), true);
  assert.equal(err.text().includes('::warning::'), false);
});

test('applies a prefix to all lines', () => {
  const out = fakeStream();
  const err = fakeStream();
  const log = createLogger({ out, err, github: false, prefix: '[my-skill]' });
  log.info('start');
  log.error('bad');
  assert.equal(out.text().includes('[my-skill] start\n'), true);
  assert.equal(err.text().includes('[my-skill] ERROR: bad\n'), true);
});
