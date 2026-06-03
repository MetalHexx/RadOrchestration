import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('cli narrowed dist layout', () => {
  it('tsconfig drops the library source include and narrows rootDir to ./src', () => {
    const tsconfig = JSON.parse(stripComments(fs.readFileSync(path.join(cliRoot, 'tsconfig.json'), 'utf8')));
    expect(tsconfig.compilerOptions.rootDir).toBe('./src');
    expect(JSON.stringify(tsconfig.include)).not.toContain('lib/repo-registry');
  });

  it('bin/start/build-and-start point at the narrowed dist layout', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
    expect(pkg.bin.radorch).toBe('./dist/bin/radorch.js');
    expect(pkg.scripts.start).toBe('node dist/bin/radorch.js');
    expect(pkg.scripts['build-and-start']).toBe('tsc && node dist/bin/radorch.js');
  });

  it('bundle entry and version suffix use the narrowed layout', () => {
    const bundle = fs.readFileSync(path.join(cliRoot, 'scripts/bundle.mjs'), 'utf8');
    expect(bundle).toContain("path.join(cliRoot, 'dist', 'bin', 'radorch.js')");
    expect(bundle).toContain("path.join('dist', 'lib', 'package-version.js')");
    expect(bundle).not.toContain("'dist', 'cli', 'src'");
  });
});
