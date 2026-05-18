import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PARITY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../build-scripts/parity-check.js');

function makePair() {
  const tmp = fs.mkdtempSync(join(os.tmpdir(), 'parity-'));
  const claude = join(tmp, 'claude-out');
  const cli = join(tmp, 'cli-out');
  // Shared agents+skills surface — identical content.
  for (const dir of [claude, cli]) {
    fs.mkdirSync(join(dir, 'skills/rad-x'), { recursive: true });
    fs.writeFileSync(join(dir, 'skills/rad-x/SKILL.md'), 'shared\n');
  }
  // Per-harness diffs that the allowlist tolerates.
  fs.mkdirSync(join(claude, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(join(claude, '.claude-plugin/plugin.json'), '{"name":"x"}');
  fs.mkdirSync(join(claude, 'agents'), { recursive: true });
  fs.writeFileSync(join(claude, 'agents/coder.md'), 'claude shape\n');
  fs.writeFileSync(join(cli, 'plugin.json'), '{"name":"x"}');
  fs.mkdirSync(join(cli, 'agents'), { recursive: true });
  fs.writeFileSync(join(cli, 'agents/coder.agent.md'), 'cli shape\n');
  return { tmp, claude, cli };
}

test('parity-check exits 0 when shared surface matches and per-harness diffs are allowlisted (FR-51, AD-21)', () => {
  const { tmp, claude, cli } = makePair();
  try {
    const result = spawnSync(process.execPath, [PARITY, `--copilot-cli=${cli}`, `--claude=${claude}`], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, `expected 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /parity-check: OK/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('parity-check exits 1 when a shared file diverges between trees (FR-51)', () => {
  const { tmp, claude, cli } = makePair();
  fs.writeFileSync(join(cli, 'skills/rad-x/SKILL.md'), 'cli divergence\n');
  try {
    const result = spawnSync(process.execPath, [PARITY, `--copilot-cli=${cli}`, `--claude=${claude}`], { encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, 'parity-check exits non-zero on shared-surface drift');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
