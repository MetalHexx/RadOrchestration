import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('CLI package scope rename', () => {
  it('cli/package.json declares @rad-orchestration/cli', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('@rad-orchestration/cli');
    expect(pkg.private).toBe(true);
  });
});
