import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(pkgRoot, 'dist');

describe('compiled library dist', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: pkgRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  });

  const modules = ['index', 'io', 'mutations', 'resolve', 'types', 'validate'];

  it('emits flat ESM .js for all six modules', () => {
    for (const m of modules) {
      expect(fs.existsSync(path.join(dist, `${m}.js`)), `${m}.js`).toBe(true);
    }
  });

  it('emits .d.ts declarations for all six modules', () => {
    for (const m of modules) {
      expect(fs.existsSync(path.join(dist, `${m}.d.ts`)), `${m}.d.ts`).toBe(true);
    }
  });

  it('uses runtime-resolvable relative specifiers ending in .js', () => {
    const index = fs.readFileSync(path.join(dist, 'index.js'), 'utf8');
    expect(index).toMatch(/from\s+['"]\.\/io\.js['"]/);
    expect(index).not.toMatch(/from\s+['"]\.\/io['"]/);
  });

  it('resolves package entry points to dist', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
    expect(pkg.main).toBe('dist/index.js');
    expect(pkg.types).toBe('dist/index.d.ts');
    expect(pkg.exports['.'].import).toBe('./dist/index.js');
    expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
  });
});
