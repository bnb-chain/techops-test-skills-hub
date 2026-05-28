'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { stripMarkdown, safeLink } = require('../scripts/lib/sanitize');

test('strips markdown link syntax from a hostile skill name (M2)', () => {
  const out = stripMarkdown('[Click here](https://lookalike.com/login)');
  assert.equal(out.includes('['), false);
  assert.equal(out.includes(']'), false);
  assert.equal(out.includes('('), false);
  assert.equal(out.includes(')'), false);
  assert.equal(out, 'Click herehttps://lookalike.com/login');
});

test('strips table-breaking pipes and backticks', () => {
  assert.equal(stripMarkdown('a | b `code`'), 'a  b code');
});

test('collapses newlines and surrounding whitespace', () => {
  assert.equal(stripMarkdown('  line1\nline2  '), 'line1 line2');
});

test('handles null/undefined safely', () => {
  assert.equal(stripMarkdown(null), '');
  assert.equal(stripMarkdown(undefined), '');
});

test('safeLink allows github.com over https', () => {
  assert.equal(
    safeLink('https://github.com/octocat/repo'),
    'https://github.com/octocat/repo',
  );
});

test('safeLink allows the agentguard report host', () => {
  assert.equal(
    safeLink('https://agentguard.gopluslabs.io/report/123'),
    'https://agentguard.gopluslabs.io/report/123',
  );
});

test('safeLink rejects a lookalike host', () => {
  assert.equal(safeLink('https://lookalike.com/login'), null);
});

test('safeLink rejects non-https and garbage', () => {
  assert.equal(safeLink('http://github.com/x/y'), null);
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink('not a url'), null);
  assert.equal(safeLink(''), null);
});
