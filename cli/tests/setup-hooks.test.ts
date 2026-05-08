import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

const setupHooksPath = path.resolve(__dirname, '..', '..', 'skills', 'rad-orchestration', 'scripts', 'setup-hooks.js');
const committedHookPath = path.resolve(__dirname, '..', '..', '.githooks', 'pre-commit');

describe('setup-hooks.js parity', () => {
  it('embedded preCommitContent contains both pipeline-runtime and cli/ blocks', async () => {
    const text = await fs.readFile(setupHooksPath, 'utf8');
    expect(text).toMatch(/skills\/rad-orchestration\/scripts/);
    expect(text).toMatch(/CLI_DIR=.*cli/);
    expect(text).toMatch(/eslint \./);
  });

  it('committed .githooks/pre-commit contains both blocks', async () => {
    const text = await fs.readFile(committedHookPath, 'utf8');
    expect(text).toMatch(/Block 1: pipeline runtime/);
    expect(text).toMatch(/Block 2: cli\/ package/);
  });
});
