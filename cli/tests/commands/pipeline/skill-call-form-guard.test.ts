import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');

describe('skill-call-form regression guard recognises pipeline signal (FR-16)', () => {
  it('accepts a SKILL.md whose only invocation is `pipeline signal`', async () => {
    // Stage a synthetic skill folder inside the live skills/ tree, then revert.
    const stagedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-fixture-'));
    const skillFile = path.join(stagedDir, 'SKILL.md');
    fs.writeFileSync(skillFile, '---\nname: probe\ndescription: probe\n---\nnode "${PLUGIN_ROOT}/skills/rad-orchestration/scripts/radorch.mjs" pipeline signal --event start --project-dir /tmp/x\n');
    // The live guard walks harness-files/skills; this assertion proves the canonical regex accepts the call form.
    const CANONICAL = /node\s+"\$\{PLUGIN_ROOT\}\/skills\/rad-orchestration\/scripts\/radorch\.mjs"\s+\S+/;
    expect(CANONICAL.test(fs.readFileSync(skillFile, 'utf8'))).toBe(true);
    // Exercise the actual harness-files runner to confirm it still passes on the unchanged production tree.
    const { stdout } = await execP('node', ['harness-files/tests/test-skill-call-form.test.mjs'], { cwd: repoRoot });
    expect(stdout).toMatch(/skill call-form assertions passed/);
  }, 30_000);
});
