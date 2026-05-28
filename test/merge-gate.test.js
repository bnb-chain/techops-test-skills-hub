'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateMergeGate, evaluateBatch } = require('../scripts/lib/merge-gate');

const bothPass = {
  agentguard_result: { verdict: 'passed' },
  hashdit_result: { verdict: 'passed' },
};

test('success only when BOTH scanners return passed (C3)', () => {
  const r = evaluateMergeGate(bothPass);
  assert.equal(r.state, 'success');
  assert.equal(r.reason, 'all-scanners-passed');
});

test('failure when AgentGuard passes but HashDit is missing (fail closed)', () => {
  const r = evaluateMergeGate({ agentguard_result: { verdict: 'passed' } });
  assert.equal(r.state, 'failure');
  assert.equal(r.reason, 'no-hashdit-result');
});

test('failure when HashDit passes but AgentGuard is missing', () => {
  const r = evaluateMergeGate({ hashdit_result: { verdict: 'passed' } });
  assert.equal(r.state, 'failure');
  assert.equal(r.reason, 'no-agentguard-result');
});

test('failure when AgentGuard verdict is failed', () => {
  const r = evaluateMergeGate({
    agentguard_result: { verdict: 'failed' },
    hashdit_result: { verdict: 'passed' },
  });
  assert.equal(r.state, 'failure');
  assert.match(r.reason, /agentguard/);
});

test('failure when HashDit verdict is failed', () => {
  const r = evaluateMergeGate({
    agentguard_result: { verdict: 'passed' },
    hashdit_result: { verdict: 'failed' },
  });
  assert.equal(r.state, 'failure');
  assert.match(r.reason, /hashdit/);
});

test('failure when a verdict is warning (fail closed)', () => {
  const r = evaluateMergeGate({
    agentguard_result: { verdict: 'passed' },
    hashdit_result: { verdict: 'warning' },
  });
  assert.equal(r.state, 'failure');
});

test('failure when agentguard_result is null (never null == safe)', () => {
  const r = evaluateMergeGate({ agentguard_result: null, hashdit_result: { verdict: 'passed' } });
  assert.equal(r.state, 'failure');
  assert.equal(r.reason, 'no-agentguard-result');
});

test('failure when metadata is missing entirely', () => {
  assert.equal(evaluateMergeGate(undefined).state, 'failure');
  assert.equal(evaluateMergeGate(null).state, 'failure');
});

test('batch passes only if every skill passes both scanners', () => {
  const allPass = evaluateBatch([bothPass, bothPass]);
  assert.equal(allPass.state, 'success');
  assert.equal(allPass.failureCount, 0);

  const oneFails = evaluateBatch([
    bothPass,
    { agentguard_result: { verdict: 'passed' }, hashdit_result: { verdict: 'failed' } },
  ]);
  assert.equal(oneFails.state, 'failure');
  assert.equal(oneFails.failureCount, 1);
});

test('empty batch is a failure (nothing proven safe)', () => {
  assert.equal(evaluateBatch([]).state, 'failure');
});
