import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runRegistryHealthChecks } from '../../../src/commands/doctor/checks.js';

let root: string;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'dh-')); });
afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

describe('registry-health doctor check', () => {
  it('warns on an unbound repo', async () => {
    fs.writeFileSync(path.join(root, 'repo-registry.yml'), 'repos:\n  a:\n    remote: g\n    default_branch: main\n    description: ""\nrepo_groups: {}\n');
    const checks = await runRegistryHealthChecks({ root });
    const unbound = checks.find((c) => c.name === 'unbound-repos')!;
    expect(unbound.status).toBe('warn');
  });
  it('warns on a bound path that no longer exists', async () => {
    fs.writeFileSync(path.join(root, 'repo-registry.yml'), 'repos:\n  a:\n    remote: g\n    default_branch: main\n    description: ""\nrepo_groups: {}\n');
    fs.writeFileSync(path.join(root, 'repo-registry.local.yml'), 'paths:\n  a: /does/not/exist\n');
    const checks = await runRegistryHealthChecks({ root });
    const missing = checks.find((c) => c.name === 'missing-local-clones')!;
    expect(missing.status).toBe('warn');
  });
  it('fails on a malformed registry', async () => {
    fs.writeFileSync(path.join(root, 'repo-registry.yml'), 'repos: : : not yaml : :\n  - broken');
    const checks = await runRegistryHealthChecks({ root });
    const malformed = checks.find((c) => c.name === 'registry-readable')!;
    expect(malformed.status).toBe('fail');
  });
});
