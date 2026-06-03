import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const commandsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/commands');

function tsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return tsFiles(p);
    return e.isFile() && p.endsWith('.ts') ? [p] : [];
  });
}

// The raw registry writers that command code must never bind directly — every
// semantic write goes through a named mutation (addRepo/editRepo/bindRepo/…).
const FORBIDDEN_NAME = '(writeIdentity|writeLocal|ensureLocalGitignored)';
const REGISTRY_SRC = "['\"][^'\"]*repo-registry[^'\"]*['\"]";
// Catch every binding form that pulls a raw writer out of the repo-registry
// seam: static ESM import, CJS require destructuring, and dynamic import().
const FORBIDDEN_PATTERNS = [
  new RegExp(`import\\s*\\{[^}]*\\b${FORBIDDEN_NAME}\\b[^}]*\\}\\s*from\\s*${REGISTRY_SRC}`),
  new RegExp(`\\{[^}]*\\b${FORBIDDEN_NAME}\\b[^}]*\\}\\s*=\\s*(?:await\\s+import|require)\\s*\\(\\s*${REGISTRY_SRC}`),
];

const bindsRawWriter = (src: string): boolean => FORBIDDEN_PATTERNS.some((p) => p.test(src));

describe('registry mutation seam', () => {
  it('no command binds raw registry writers — all writes go through named mutations', () => {
    const offenders = tsFiles(commandsDir).filter((f) => bindsRawWriter(fs.readFileSync(f, 'utf8')));
    expect(offenders, `These commands must call a library mutation, not write inline:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the guard catches every binding form and ignores safe imports', () => {
    // Violations — static, CJS, and dynamic binding of a raw writer from the seam.
    expect(bindsRawWriter(`import { writeIdentity } from '@rad-orchestration/repo-registry';`)).toBe(true);
    expect(bindsRawWriter(`import { readRegistry, writeLocal } from '@rad-orchestration/repo-registry';`)).toBe(true);
    expect(bindsRawWriter(`const { ensureLocalGitignored } = require('@rad-orchestration/repo-registry');`)).toBe(true);
    expect(bindsRawWriter(`const { writeLocal } = await import('@rad-orchestration/repo-registry');`)).toBe(true);
    // Safe — named mutations/reads from the seam, and writers from unrelated modules.
    expect(bindsRawWriter(`import { readRegistry, editRepo, bindRepo } from '@rad-orchestration/repo-registry';`)).toBe(false);
    expect(bindsRawWriter(`import { writeIdentity } from './some-other-module.js';`)).toBe(false);
  });
});
