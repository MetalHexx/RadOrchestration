import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'archive',
  // Out-of-scope subsystems for this corrective (FR-14 path-string sweep):
  // these directories carry their own functional path strings and were not
  // listed in the corrective's File Targets. Sweep is narrowed to the
  // .claude/, prompt-tests/, and docs/ scope per the handoff's "narrow the
  // test scope rather than editing the excluded file" guidance.
  '.agents', 'installer', 'ui',
]);
const SKIP_FILE_GLOBS = [
  // Historical baseline run-notes — intentionally frozen
  /[\\/]baseline-[^\\/]+[\\/]run-notes\.md$/,
  /[\\/]baseline-[^\\/]+[\\/]lint-report\.md$/,
  // Root README.md is not in the corrective's File Targets — out of scope.
  /^README\.md$/,
  // The sweep test itself contains the literal search string as a pattern,
  // not as a functional path. Exclude self-reference to avoid false positive.
  /[\\/]test-functional-path-sweep\.test\.mjs$/,
];
const SCAN_EXTS = new Set(['.md', '.js', '.ts', '.mjs', '.cjs', '.yml', '.yaml']);
function walk(dir, out=[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    if (!SCAN_EXTS.has(path.extname(e.name))) continue;
    const rel = path.relative(repoRoot, p);
    if (SKIP_FILE_GLOBS.some(rx => rx.test(rel) || rx.test(p))) continue;
    out.push(p);
  }
  return out;
}
const hits = [];
for (const f of walk(repoRoot)) {
  const text = readFileSync(f, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('skills/orchestration/') || line.includes("'skills', 'orchestration'") || line.includes('"skills", "orchestration"')) {
      hits.push(`${path.relative(repoRoot, f)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    }
  });
}
assert.deepEqual(hits, [], 'functional `skills/orchestration/` path strings remain in active code:\n  - ' + hits.join('\n  - '));
console.log('functional path-string sweep assertions passed');
