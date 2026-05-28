'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { scan } = require('../scripts/lib/hashdit');

const silentLogger = { info() {}, warn() {}, error() {} };
const goodPayload = { ok: true, reason: null, content: '### a.md\nhello' };

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('returns passed when HashDit verdict is passed', async () => {
  const fetchImpl = async () => jsonResponse(200, {
    data: { verdict: 'passed', scanId: 'h1', reportUrl: 'https://hashdit.io/r/h1', riskLevel: 'low' },
  });
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger });
  assert.equal(out.status, 'passed');
  assert.equal(out.result.verdict, 'passed');
  assert.equal(out.scan_id, 'h1');
  assert.equal(out.report_url, 'https://hashdit.io/r/h1');
});

test('fails closed when verdict is not passed', async () => {
  const fetchImpl = async () => jsonResponse(200, { data: { verdict: 'warning' } });
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger });
  assert.equal(out.status, 'failed');
  assert.equal(out.result.verdict, 'failed');
});

test('fails closed when the API key is missing', async () => {
  const out = await scan({ payload: goodPayload, apiKey: '', fetchImpl: async () => {}, logger: silentLogger });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, 'missing-api-key');
  assert.equal(out.result.verdict, 'failed');
});

test('fails closed when there is no scannable content', async () => {
  const payload = { ok: false, reason: 'no-scannable-content', content: '' };
  const out = await scan({ payload, apiKey: 'k', fetchImpl: async () => {}, logger: silentLogger });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, 'no-scannable-content');
});

test('fails closed on a non-2xx HTTP response', async () => {
  const fetchImpl = async () => jsonResponse(403, {});
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger, httpOptions: { retries: 0 } });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, 'http-403');
});

test('fails closed when the request throws (timeout/network)', async () => {
  const fetchImpl = async () => { throw new Error('boom'); };
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger, httpOptions: { retries: 0 } });
  assert.equal(out.status, 'failed');
  assert.match(out.reason, /^request-error:/);
});

test('fails closed when the response is missing the data envelope', async () => {
  const fetchImpl = async () => jsonResponse(200, { notData: true });
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, 'missing-data-envelope');
});

test('fails closed when the response fails schema validation', async () => {
  const fetchImpl = async () => jsonResponse(200, { data: { verdict: 'definitely-safe' } });
  const out = await scan({ payload: goodPayload, apiKey: 'k', fetchImpl, logger: silentLogger });
  assert.equal(out.status, 'failed');
  assert.equal(out.reason, 'schema-validation-failed');
});
