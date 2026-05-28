'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { renderComment } = require('../scripts/render-comment');

const baseSkill = {
  name: 'My Skill',
  github_url: 'https://github.com/octocat/Hello-World',
  category: ['defi', 'analytics'],
  owner: { username: 'octocat', profile_url: 'https://github.com/octocat' },
  latest_commit: 'abc1234def5678',
  agentguard_result: { verdict: 'passed' },
  agentguard_report_url: 'https://agentguard.gopluslabs.io/r/ag1',
  hashdit_result: { verdict: 'passed' },
  hashdit_report_url: 'https://hashdit.io/r/hd1',
};

test('renders a comment with both scanner verdicts', () => {
  const body = renderComment([baseSkill]);
  assert.match(body, /My Skill/);
  assert.match(body, /AgentGuard/);
  assert.match(body, /HashDit/);
  assert.match(body, /passed/);
  assert.match(body, /abc1234/);
});

test('neutralizes a markdown-injection skill name (M2)', () => {
  const hostile = { ...baseSkill, name: '[Click here](https://lookalike.com/login)' };
  const body = renderComment([hostile]);
  assert.equal(body.includes('](https://lookalike.com/login)'), false);
  assert.equal(body.includes('[Click here]'), false);
});

test('renders an allow-listed report URL as a link', () => {
  const body = renderComment([baseSkill]);
  assert.match(body, /\[report\]\(https:\/\/agentguard\.gopluslabs\.io\/r\/ag1\)/);
});

test('does not render a lookalike report URL as a link', () => {
  const evil = { ...baseSkill, agentguard_report_url: 'https://evil.com/phish' };
  const body = renderComment([evil]);
  assert.equal(body.includes('https://evil.com/phish'), false);
});

test('shows a failed verdict plainly when a scanner blocks', () => {
  const blocked = { ...baseSkill, hashdit_result: { verdict: 'failed' }, hashdit_report_url: null };
  const body = renderComment([blocked]);
  assert.match(body, /failed/);
});

test('handles a missing scanner result without throwing', () => {
  const partial = { ...baseSkill, hashdit_result: null, hashdit_report_url: null };
  const body = renderComment([partial]);
  assert.ok(typeof body === 'string' && body.length > 0);
});
