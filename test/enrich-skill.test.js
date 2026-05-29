'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { enrichSkill } = require('../scripts/enrich-skill');

const silentLogger = { info() {}, warn() {}, error() {}, group() {}, groupEnd() {} };

const parsed = {
  skill_id: 'my-skill',
  name: 'My Skill',
  github_url: 'https://github.com/octocat/Hello-World',
  category: ['defi'],
  description: 'Does a thing.',
};

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}
function textResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => body };
}

// Routes GitHub + scanner calls by URL substring. `agentguard` controls the
// scanner verdict.
function makeFetch({ agentguard = 'passed' } = {}) {
  return async (url) => {
    if (url.includes('api.github.com/repos/octocat/Hello-World/commits')) {
      return jsonResponse(200, [{ sha: 'abc1234def' }]);
    }
    if (url.includes('api.github.com/repos/octocat/Hello-World/git/trees/')) {
      return jsonResponse(200, { tree: [{ type: 'blob', path: 'SKILL.md' }, { type: 'blob', path: 'run.py' }] });
    }
    if (url.includes('api.github.com/repos/octocat/Hello-World')) {
      return jsonResponse(200, { html_url: 'https://github.com/octocat/Hello-World', default_branch: 'main', stargazers_count: 42 });
    }
    if (url.includes('api.github.com/users/octocat')) {
      return jsonResponse(200, { login: 'octocat', name: 'The Octocat', type: 'User', avatar_url: 'https://avatars.githubusercontent.com/u/1' });
    }
    if (url.includes('raw.githubusercontent.com')) {
      return textResponse(200, 'file content');
    }
    if (url.includes('agentguard.gopluslabs.io')) {
      return jsonResponse(200, { data: { verdict: agentguard, scanId: 'ag1', reportUrl: 'https://agentguard.gopluslabs.io/r/ag1' } });
    }
    throw new Error(`unexpected url: ${url}`);
  };
}

const keys = { githubToken: 'gh', agentguardKey: 'ag' };

test('enriches with AgentGuard passing', async () => {
  const out = await enrichSkill({ parsed, ...keys, fetchImpl: makeFetch(), logger: silentLogger, now: () => '2026-01-01T00:00:00.000Z' });
  assert.equal(out.github_url, 'https://github.com/octocat/Hello-World');
  assert.equal(out.owner.username, 'octocat');
  assert.equal(out.owner.display_name, 'The Octocat');
  assert.equal(out.repo.stars, 42);
  assert.equal(out.repo.default_branch, 'main');
  assert.equal(out.latest_commit, 'abc1234def');
  assert.equal(out.agentguard_result.verdict, 'passed');
  assert.equal(out.agentguard_scan_id, 'ag1');
  assert.equal(out.evaluated_at, '2026-01-01T00:00:00.000Z');
  assert.equal('hashdit_result' in out, false);
});

test('records a failed AgentGuard verdict (fail closed)', async () => {
  const out = await enrichSkill({ parsed, ...keys, fetchImpl: makeFetch({ agentguard: 'warning' }), logger: silentLogger });
  assert.equal(out.agentguard_result.verdict, 'failed');
});

test('throws when the GitHub repo is not accessible', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('api.github.com/repos/')) return jsonResponse(404, { message: 'Not Found' });
    throw new Error(`unexpected url: ${url}`);
  };
  await assert.rejects(
    () => enrichSkill({ parsed, ...keys, fetchImpl, logger: silentLogger, httpOptions: { retries: 0 } }),
    /GitHub API error 404/,
  );
});

test('fails the scanner closed when no scannable content is found', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/commits')) return jsonResponse(200, [{ sha: 'abc' }]);
    if (url.includes('/git/trees/')) return jsonResponse(200, { tree: [{ type: 'blob', path: 'logo.png' }] });
    if (url.includes('api.github.com/repos/')) return jsonResponse(200, { html_url: 'https://github.com/octocat/Hello-World', default_branch: 'main', stargazers_count: 1 });
    if (url.includes('api.github.com/users/')) return jsonResponse(200, { login: 'octocat', type: 'User' });
    throw new Error(`unexpected url: ${url}`);
  };
  const out = await enrichSkill({ parsed, ...keys, fetchImpl, logger: silentLogger });
  assert.equal(out.agentguard_result.verdict, 'failed');
});
