'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseGithubUrl } = require('../scripts/lib/parse-url');

test('parses a canonical github url', () => {
  const { owner, repo, canonical } = parseGithubUrl('https://github.com/octocat/Hello-World');
  assert.equal(owner, 'octocat');
  assert.equal(repo, 'Hello-World');
  assert.equal(canonical, 'https://github.com/octocat/Hello-World');
});

test('strips a trailing .git suffix', () => {
  const { repo, canonical } = parseGithubUrl('https://github.com/octocat/Hello-World.git');
  assert.equal(repo, 'Hello-World');
  assert.equal(canonical, 'https://github.com/octocat/Hello-World');
});

test('ignores extra path segments and query', () => {
  const { owner, repo } = parseGithubUrl('https://github.com/octocat/Hello-World/tree/main?x=1');
  assert.equal(owner, 'octocat');
  assert.equal(repo, 'Hello-World');
});

test('rejects lookalike host github.com.evil.com (M5)', () => {
  assert.throws(
    () => parseGithubUrl('https://github.com.evil.com/octocat/Hello-World'),
    /host must be exactly github\.com/,
  );
});

test('rejects a host that merely contains github.com in the path', () => {
  assert.throws(
    () => parseGithubUrl('https://evil.com/github.com/octocat/repo'),
    /host must be exactly github\.com/,
  );
});

test('rejects non-https urls', () => {
  assert.throws(() => parseGithubUrl('http://github.com/octocat/Hello-World'), /must use https/);
});

test('rejects urls missing a repo segment', () => {
  assert.throws(() => parseGithubUrl('https://github.com/octocat'), /must include owner and repo/);
});

test('rejects empty / non-string input', () => {
  assert.throws(() => parseGithubUrl(''), /non-empty string/);
  assert.throws(() => parseGithubUrl(null), /non-empty string/);
});

test('rejects owner/repo with invalid characters', () => {
  assert.throws(
    () => parseGithubUrl('https://github.com/oc tocat/Hello World'),
    /invalid characters|must include owner and repo/,
  );
});
