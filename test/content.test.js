'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  hasScannableExtension,
  selectCandidatePaths,
  buildScanContent,
} = require('../scripts/lib/content');

test('broadens scannable extensions beyond .md (H2)', () => {
  for (const p of ['SKILL.md', 'run.py', 'install.sh', 'config.json', 'action.yml', 'index.ts', 'app.js']) {
    assert.equal(hasScannableExtension(p), true, `${p} should be scannable`);
  }
  for (const p of ['image.png', 'binary.exe', 'archive.zip', 'LICENSE']) {
    assert.equal(hasScannableExtension(p), false, `${p} should not be scannable`);
  }
});

test('selects scannable blobs root-first and caps file count', () => {
  const tree = [
    { type: 'blob', path: 'src/deep/util.py' },
    { type: 'blob', path: 'README.md' },
    { type: 'tree', path: 'src' },
    { type: 'blob', path: 'src/app.js' },
    { type: 'blob', path: 'logo.png' },
  ];
  const paths = selectCandidatePaths(tree, { maxFiles: 10 });
  assert.deepEqual(paths, ['README.md', 'src/app.js', 'src/deep/util.py']);
});

test('buildScanContent concatenates files with path headers', () => {
  const result = buildScanContent([
    { path: 'a.md', text: 'hello' },
    { path: 'b.py', text: 'print(1)' },
  ]);
  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.match(result.content, /### a\.md\nhello/);
  assert.match(result.content, /### b\.py\nprint\(1\)/);
});

test('reports failure (not silent skip) when there is no content (M1)', () => {
  const result = buildScanContent([]);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-scannable-content');
});

test('fails when a single file exceeds the per-file byte cap (M1)', () => {
  const big = 'x'.repeat(300 * 1024);
  const result = buildScanContent([{ path: 'big.md', text: big }], { maxFileBytes: 256 * 1024 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /^file-too-large:big\.md$/);
});

test('fails when the total payload exceeds the budget (M1)', () => {
  const chunk = 'y'.repeat(200 * 1024);
  const files = Array.from({ length: 10 }, (_, i) => ({ path: `f${i}.md`, text: chunk }));
  const result = buildScanContent(files, { maxFileBytes: 256 * 1024, maxTotalBytes: 1024 * 1024 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'total-payload-too-large');
});
