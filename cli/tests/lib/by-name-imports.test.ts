import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    if (e.isDirectory()) walk(abs, acc);
    else if (/\.(ts|mts)$/.test(e.name)) acc.push(abs);
  }
  return acc;
}

describe('cli consumes the library by name', () => {
  it('has no real import of the deep relative library path', () => {
    // exclude the mutation-seam test, which carries the deep path inside string literals by design
    const seam = path.join(cliRoot, 'tests/lib/registry-mutation-seam.test.ts');
    const offenders = [...walk(path.join(cliRoot, 'src')), ...walk(path.join(cliRoot, 'tests'))]
      .filter((f) => path.resolve(f) !== path.resolve(seam))
      .filter((f) => /^\s*import[^;]*from\s+['"][^'"]*lib\/repo-registry\/src\/index\.js['"]/m.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('declares the library as a dependency', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@rad-orchestration/repo-registry']).toBeDefined();
  });
});
