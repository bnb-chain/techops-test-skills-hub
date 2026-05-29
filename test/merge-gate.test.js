'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { evaluateMergeGate, evaluateBatch } = require('../scripts/lib/merge-gate');

test('success only when AgentGuard verdict is passed (C3)', () => {
  const r = evaluateMergeGate({ agentguard_result: { verdict: 'passed' } });
  assert.equal(r.state, 'success');
  assert.equal(r.reason, 'agentguard-passed');
});

test('failure when verdict is failed', () => {
  const r = evaluateMergeGate({ agentguard_result: { verdict: 'failed' } });
  assert.equal(r.state, 'failure');
});

test('failure when verdict is warning (fail closed)', () => {
  const r = evaluateMergeGate({ agentguard_result: { verdict: 'warning' } });
  assert.equal(r.state, 'failure');
});

test('failure when agentguard_result is null (never null == safe)', () => {
  const r = evaluateMergeGate({ agentguard_result: null });
  assert.equal(r.state, 'failure');
  assert.equal(r.reason, 'no-agentguard-result');
});

test('failure when metadata is missing entirely', () => {
  assert.equal(evaluateMergeGate(undefined).state, 'failure');
  assert.equal(evaluateMergeGate(null).state, 'failure');
});

test('batch passes only if every skill passes', () => {
  const allPass = evaluateBatch([
    { agentguard_result: { verdict: 'passed' } },
    { agentguard_result: { verdict: 'passed' } },
  ]);
  assert.equal(allPass.state, 'success');
  assert.equal(allPass.failureCount, 0);

  const oneFails = evaluateBatch([
    { agentguard_result: { verdict: 'passed' } },
    { agentguard_result: { verdict: 'failed' } },
  ]);
  assert.equal(oneFails.state, 'failure');
  assert.equal(oneFails.failureCount, 1);
});

test('empty batch is a failure (nothing proven safe)', () => {
  assert.equal(evaluateBatch([]).state, 'failure');
});
