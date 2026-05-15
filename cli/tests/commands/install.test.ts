import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runInstall } from '../../src/commands/install.js';

const require_ = createRequire(import.meta.url);
const pkg = require_('../../package.json') as { version: string };

let tmp: string;
let homedirSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-install-'));
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
});
afterEach(async () => {
  homedirSpy.mockRestore();
  await fs.rm(tmp, { recursive: true, force: true });
});

// resolveInstallRoot() returns path.join(os.homedir(), '.radorch') = path.join(tmp, '.radorch')
function getRoot(): string { return path.join(tmp, '.radorch'); }

function makeCtx() {
  return {
    env: { RADORCH_NO_LOG: '1' } as NodeJS.ProcessEnv,
    ux: { isTTY: false, nonInteractive: true, noColor: true, json: true },
    stderr: process.stderr,
  };
}

async function writeFakeInstallJson(root: string, packageVersion: string) {
  await fs.mkdir(root, { recursive: true });
  await fs.writeFile(
    path.join(root, 'install.json'),
    JSON.stringify({
      package_version: packageVersion,
      installed_at: new Date().toISOString(),
      last_writer_version: packageVersion,
      state_schema_version: 'v5',
    }, null, 2) + '\n',
    'utf8',
  );
}

describe('radorch install', () => {
  it('returns idempotent success when install.json exists at the same version', async () => {
    const root = getRoot();
    await writeFakeInstallJson(root, pkg.version);
    const r = await runInstall({ defaultHarness: 'claude', ctx: makeCtx() });
    expect(r.already_installed).toBe(true);
    expect(r.version).toBe(pkg.version);
    expect(r.root).toBe(root);
  });

  it('errors with user_error when install.json exists at a different (older) version', async () => {
    const root = getRoot();
    await writeFakeInstallJson(root, '0.0.0');
    await expect(
      runInstall({ defaultHarness: 'claude', ctx: makeCtx() }),
    ).rejects.toMatchObject({ type: 'user_error' });
  });

  it('errors with user_error when install.json is corrupted', async () => {
    const root = getRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'install.json'), 'not json{', 'utf8');
    await expect(
      runInstall({ defaultHarness: 'claude', ctx: makeCtx() }),
    ).rejects.toMatchObject({ type: 'user_error' });
  });

  it('errors with user_error when install.json is missing package_version field', async () => {
    const root = getRoot();
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, 'install.json'), JSON.stringify({ installed_at: new Date().toISOString() }), 'utf8');
    await expect(
      runInstall({ defaultHarness: 'claude', ctx: makeCtx() }),
    ).rejects.toMatchObject({ type: 'user_error' });
  });

  it('writes the full skeleton (install.json, config.yml, registry.yml, .harness, .gitignore, dirs, harness bundles)', async () => {
    const root = getRoot();
    const result = await runInstall({ defaultHarness: 'copilot-vscode', ctx: makeCtx() });
    expect(result.root).toBe(root);
    expect(result.harnesses_installed).toEqual(['claude', 'copilot-vscode', 'copilot-cli']);
    expect(result.active_harness).toBe('copilot-vscode');

    // install.json
    const installJson = JSON.parse(await fs.readFile(path.join(root, 'install.json'), 'utf8'));
    expect(typeof installJson.package_version).toBe('string');
    expect(typeof installJson.installed_at).toBe('string');

    // config.yml
    const configText = await fs.readFile(path.join(root, 'config.yml'), 'utf8');
    expect(configText).toContain('default_active_harness: copilot-vscode');

    // registry.yml — empty skeleton
    const regText = await fs.readFile(path.join(root, 'registry.yml'), 'utf8');
    expect(regText).toContain('repos:');
    expect(regText).toContain('workspaces:');

    // .harness pointer
    expect((await fs.readFile(path.join(root, '.harness'), 'utf8')).trim()).toBe('copilot-vscode');

    // .gitignore present
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore.length).toBeGreaterThan(0);

    // empty dirs
    for (const dir of ['projects', 'worktrees', 'logs']) {
      const stat = await fs.stat(path.join(root, dir));
      expect(stat.isDirectory()).toBe(true);
    }

    // harness bundles
    for (const h of ['claude', 'copilot-vscode', 'copilot-cli']) {
      const stat = await fs.stat(path.join(root, 'runtime', 'harnesses', h));
      expect(stat.isDirectory()).toBe(true);
    }
  });
});
