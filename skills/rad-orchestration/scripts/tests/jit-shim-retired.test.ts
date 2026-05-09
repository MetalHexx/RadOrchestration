import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('JIT pipeline shim retired', () => {
  it('pipeline.js source file (the JIT shim) is no longer tracked at scripts/pipeline.js', () => {
    // Bundle output may exist at this path post-build, but the source-tree
    // entry must be gone — assert no `npm ci` / `npx tsx` strings appear in
    // any scripts/pipeline.js found on disk.
    const p = path.join(scriptsDir, 'pipeline.js');
    if (!fs.existsSync(p)) return; // clean: bundle output not present in source tree
    const text = fs.readFileSync(p, 'utf8');
    expect(text).not.toMatch(/npm\s+ci/);
    expect(text).not.toMatch(/npx\s+tsx/);
  });
  it('package.json declares tsx as a devDependency only', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(scriptsDir, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.tsx).toBeUndefined();
    expect(pkg.devDependencies?.tsx).toBeDefined();
  });
});
