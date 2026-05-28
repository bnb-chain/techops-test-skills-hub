'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseSubmission } = require('../scripts/parse-submission');

const silentLogger = { info() {}, warn() {}, error() {} };

const validRaw = JSON.stringify({
  name: 'My Skill',
  github_url: 'https://github.com/octocat/Hello-World',
  category: ['defi', 'analytics'],
  description: 'Does a useful thing.',
});

test('parses a valid submission into a data-only artifact', () => {
  const out = parseSubmission({ raw: validRaw, fileName: 'skills/my-skill-metadata.json', logger: silentLogger });
  assert.equal(out.ok, true);
  assert.equal(out.skillId, 'my-skill');
  assert.deepEqual(out.artifact, {
    skill_id: 'my-skill',
    name: 'My Skill',
    github_url: 'https://github.com/octocat/Hello-World',
    category: ['defi', 'analytics'],
    description: 'Does a useful thing.',
  });
  assert.deepEqual(out.errors, []);
});

test('canonicalizes the github_url (drops trailing slash / extra)', () => {
  const raw = JSON.stringify({
    github_url: 'https://github.com/octocat/Hello-World/',
    category: ['x'],
    description: 'y',
  });
  const out = parseSubmission({ raw, fileName: 'skills/foo-metadata.json', logger: silentLogger });
  assert.equal(out.ok, true);
  assert.equal(out.artifact.github_url, 'https://github.com/octocat/Hello-World');
});

test('rejects unknown fields (strict contract, C1)', () => {
  const raw = JSON.stringify({
    github_url: 'https://github.com/octocat/Hello-World',
    category: ['x'],
    description: 'y',
    evil: 'extra',
  });
  const out = parseSubmission({ raw, fileName: 'skills/foo-metadata.json', logger: silentLogger });
  assert.equal(out.ok, false);
  assert.ok(out.errors.length > 0);
});

test('rejects a missing required field', () => {
  const raw = JSON.stringify({ github_url: 'https://github.com/octocat/Hello-World', category: ['x'] });
  const out = parseSubmission({ raw, fileName: 'skills/foo-metadata.json', logger: silentLogger });
  assert.equal(out.ok, false);
});

test('rejects a lookalike github host (M5)', () => {
  const raw = JSON.stringify({
    github_url: 'https://github.com.evil.com/octocat/Hello-World',
    category: ['x'],
    description: 'y',
  });
  const out = parseSubmission({ raw, fileName: 'skills/foo-metadata.json', logger: silentLogger });
  assert.equal(out.ok, false);
});

test('rejects invalid JSON', () => {
  const out = parseSubmission({ raw: '{ not json', fileName: 'skills/foo-metadata.json', logger: silentLogger });
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /JSON/i.test(e)));
});

test('derives skill_id from the filename, not from submitted content', () => {
  const out = parseSubmission({ raw: validRaw, fileName: 'skills/totally-different-metadata.json', logger: silentLogger });
  assert.equal(out.skillId, 'totally-different');
});
