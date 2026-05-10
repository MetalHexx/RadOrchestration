import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('post-rename suite guard', () => {
  it('no test under tests/ asserts against the literal string "main.ts"', () => {
    const offenders: string[] = [];
    // Exclude validation tests that intentionally check for the rename
    const allowlist = new Set([
      'static-compliance.test.ts',
      'post-rename-suite-guard.test.ts',
    ]);
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir)) {
        const abs = path.join(dir, e);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) { walk(abs); continue; }
        if (!/\.test\.(ts|mts|js|mjs)$/.test(e)) continue;
        if (allowlist.has(e)) continue; // skip validation tests
        const text = fs.readFileSync(abs, 'utf8');
        if (/\bmain\.ts\b/.test(text)) offenders.push(abs);
      }
    };
    walk(path.join(scriptsDir, 'tests'));
    expect(offenders).toEqual([]);
  });
});
