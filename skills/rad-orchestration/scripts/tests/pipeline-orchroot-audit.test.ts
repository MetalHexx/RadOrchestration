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
  // state-io DEFAULT_CONFIG authored-install default — overwritten on first
  // readConfig() call; not a load-bearing runtime path lookup.
  "authored-install-default",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
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
