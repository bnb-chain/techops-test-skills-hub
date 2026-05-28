'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../scripts/check-merge-gate');

const silentLogger = { info() {}, warn() {}, error() {}, group() {}, groupEnd() {} };

const pass = { agentguard_result: { verdict: 'passed' }, hashdit_result: { verdict: 'passed' } };
const fail = { agentguard_result: { verdict: 'passed' }, hashdit_result: { verdict: 'failed' } };

function readerFor(map) {
  return (p) => {
    if (!(p in map)) throw new Error(`ENOENT ${p}`);
    return JSON.stringify(map[p]);
  };
}

test('exit code 0 when every skill passes both scanners', () => {
  const code = run(['enriched/a.json', 'enriched/b.json'], {
    logger: silentLogger,
    readFile: readerFor({ 'enriched/a.json': pass, 'enriched/b.json': pass }),
  });
  assert.equal(code, 0);
});

test('exit code 1 when any skill fails', () => {
  const code = run(['enriched/a.json', 'enriched/b.json'], {
    logger: silentLogger,
    readFile: readerFor({ 'enriched/a.json': pass, 'enriched/b.json': fail }),
  });
  assert.equal(code, 1);
});

test('exit code 1 when there are no artifacts (nothing proven safe)', () => {
  const code = run([], { logger: silentLogger, readFile: readerFor({}) });
  assert.equal(code, 1);
});

test('exit code 1 when an artifact cannot be read (fail closed)', () => {
  const code = run(['enriched/missing.json'], { logger: silentLogger, readFile: readerFor({}) });
  assert.equal(code, 1);
});

test('exit code 1 when an artifact is malformed JSON', () => {
  const code = run(['enriched/bad.json'], {
    logger: silentLogger,
    readFile: () => '{ not json',
  });
  assert.equal(code, 1);
});
