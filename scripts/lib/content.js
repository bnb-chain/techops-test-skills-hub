'use strict';

/**
 * Repo content selection and byte budgeting for the scanner (findings H2, M1).
 *
 * H2: AgentGuard previously only saw `.md` files, so payloads could hide in
 *     `.py`/`.sh`/`.json`/etc. We broaden the candidate set.
 * M1: We cap per-file and total bytes. Oversize content is reported as a FAILED
 *     scan (requires maintainer override), never silently truncated or skipped,
 *     because a partial scan is indistinguishable from a clean one downstream.
 */

const SCANNABLE_EXTENSIONS = [
  '.md', '.mdx', '.json', '.yml', '.yaml', '.py', '.js', '.ts', '.sh',
];

const DEFAULT_MAX_FILE_BYTES = 256 * 1024;       // 256 KB
const DEFAULT_MAX_TOTAL_BYTES = 1024 * 1024;     // 1 MB
const DEFAULT_MAX_FILES = 50;

function hasScannableExtension(filePath) {
  if (typeof filePath !== 'string') return false;
  const lower = filePath.toLowerCase();
  return SCANNABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Selects scannable blob paths from a GitHub git-tree listing, root files first.
 * @param {Array<{type:string, path:string}>} tree
 */
function selectCandidatePaths(tree, { maxFiles = DEFAULT_MAX_FILES } = {}) {
  if (!Array.isArray(tree)) return [];
  return tree
    .filter((entry) => entry && entry.type === 'blob' && hasScannableExtension(entry.path))
    .sort((a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path))
    .slice(0, maxFiles)
    .map((entry) => entry.path);
}

function depth(p) {
  return (p.match(/\//g) || []).length;
}

/**
 * Assembles the scan payload from fetched files while enforcing byte caps.
 * @param {Array<{path:string, text:string}>} files
 * @returns {{ ok:boolean, reason:(string|null), content:string, totalBytes:number }}
 */
function buildScanContent(files, {
  maxFileBytes = DEFAULT_MAX_FILE_BYTES,
  maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES,
} = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, reason: 'no-scannable-content', content: '', totalBytes: 0 };
  }

  let totalBytes = 0;
  const parts = [];

  for (const file of files) {
    const text = typeof file.text === 'string' ? file.text : '';
    const bytes = Buffer.byteLength(text, 'utf8');

    if (bytes > maxFileBytes) {
      return {
        ok: false,
        reason: `file-too-large:${file.path}`,
        content: '',
        totalBytes: bytes,
      };
    }

    totalBytes += bytes;
    if (totalBytes > maxTotalBytes) {
      return {
        ok: false,
        reason: 'total-payload-too-large',
        content: '',
        totalBytes,
      };
    }

    parts.push(`### ${file.path}\n${text}`);
  }

  return { ok: true, reason: null, content: parts.join('\n\n'), totalBytes };
}

module.exports = {
  SCANNABLE_EXTENSIONS,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_TOTAL_BYTES,
  DEFAULT_MAX_FILES,
  hasScannableExtension,
  selectCandidatePaths,
  buildScanContent,
};
