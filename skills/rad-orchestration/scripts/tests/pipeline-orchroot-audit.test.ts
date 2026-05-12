// pipeline-orchroot-audit.test.ts — Static guard against re-introducing
// hardcoded '.claude' install-root strings in pipeline runtime files.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Scan the scripts/ folder (parent of tests/)
const here = path.resolve(__dirname, '..');

const ALLOWLIST_SUBSTRINGS = [
  // Documentation-only or harness-illustrative occurrences allowed:
  "// e.g.",
  "// example:",
  "// '.claude'",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    if (e.name === 'dist') continue;                         // gitignored tsc build output
    if (e.name === 'pipeline.js' && !e.isDirectory()) continue;  // generated esbuild bundle
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'fixtures') continue;
      walk(p, acc);
    } else if (/\.(js|ts|mjs|cjs)$/.test(e.name) && !/\.test\.[mc]?[jt]s$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('pipeline runtime hardcoded-.claude audit', () => {
  it('contains no unflagged literal .claude install-root strings', () => {
    const offenders: string[] = [];
    for (const f of walk(here)) {
      const text = fs.readFileSync(f, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (!line.includes('.claude')) return;
        if (ALLOWLIST_SUBSTRINGS.some((s) => line.includes(s))) return;
        offenders.push(`${path.relative(here, f)}:${idx + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

// ── Bundle-geometry guard ─────────────────────────────────────────────────────
//
// `lib/*.ts` is bundled by esbuild into `scripts/pipeline.js` — one level
// shallower than the source files. Any `fileURLToPath(import.meta.url)` call
// inside `lib/` therefore resolves to the bundle's location at runtime, not
// the source's, and any `..` walk from there lands at the wrong directory.
// Resolved filesystem paths must instead be threaded in from `pipeline.ts`
// (which sits at the same depth as the bundle output) via `PathContext`.
//
// This guard fails if any `lib/*.ts` reintroduces `fileURLToPath(import.meta.url)`.

const LIB_DIR = path.resolve(__dirname, '..', 'lib');

describe('pipeline runtime lib/ bundle-geometry guard', () => {
  it('no file under scripts/lib/ uses fileURLToPath(import.meta.url)', () => {
    const offenders: string[] = [];
    for (const e of fs.readdirSync(LIB_DIR, { withFileTypes: true })) {
      if (!e.isFile() || !/\.ts$/.test(e.name)) continue;
      const filePath = path.join(LIB_DIR, e.name);
      const text = fs.readFileSync(filePath, 'utf8');
      const lines = text.split(/\r?\n/);
      lines.forEach((line, idx) => {
        // Strip line comments so doc prose mentioning the forbidden pattern
        // is not flagged. Block comments are rare here and intentionally
        // not stripped — flagging them surfaces accidental code.
        const codeOnly = line.split('//')[0];
        if (codeOnly.includes('fileURLToPath(import.meta.url)')) {
          offenders.push(`${path.relative(here, filePath)}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
