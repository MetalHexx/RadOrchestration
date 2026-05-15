import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runDoctor, doctorCommand, renderDoctorForTest } from '../../src/commands/doctor/index.js';
import { writeInstallSkeleton } from '../../src/commands/install/skeleton.js';
import { validateEnvelope } from '../../src/framework/output.js';
import { runPluginChecks, runInstallChecks, type CheckResult } from '../../src/commands/doctor/checks.js';

let tmp: string;
let homedirSpy: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc-'));
  homedirSpy = vi.spyOn(os, 'homedir').mockReturnValue(tmp);
});
afterEach(async () => {
  homedirSpy.mockRestore();
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('radorch doctor', () => {
  it('reports Install failure when ~/.radorch is absent', async () => {
    // tmp/.radorch does not exist — spy makes resolveInstallRoot() return tmp/.radorch
    const result = await runDoctor({ env: process.env });
    expect(result.all_passed).toBe(false);
    const installCategory = result.checks.filter((c) => c.category === 'Install');
    expect(installCategory.some((c) => c.status === 'fail')).toBe(true);
  });

  it('reports all_passed=true with a Registry warn when installed but empty', async () => {
    const root = path.join(tmp, '.radorch');
    await writeInstallSkeleton({ root, packageVersion: '0.0.0', defaultHarness: 'claude' });
    const result = await runDoctor({ env: process.env });
    expect(result.all_passed).toBe(true); // warns allowed; only fails block
    const reg = result.checks.find((c) => c.category === 'Registry');
    expect(reg?.status).toBe('warn');
    expect(['Environment', 'Install', 'Registry', 'Plugin']).toEqual([
      ...new Set(result.checks.map((c) => c.category)),
    ]);
  });

  it('every check carries a closed-enum status', async () => {
    const root = path.join(tmp, '.radorch');
    await writeInstallSkeleton({ root, packageVersion: '0.0.0', defaultHarness: 'claude' });
    const result = await runDoctor({ env: process.env });
    for (const c of result.checks) {
      expect(['pass', 'warn', 'fail']).toContain(c.status);
    }
  });
});

describe('doctorCommand mapResult', () => {
  it('produces a valid `ok: true` envelope with exit_code 0 when all_passed', () => {
    const r = { all_passed: true, checks: [] };
    const env = doctorCommand.mapResult!(r);
    expect(() => validateEnvelope(env)).not.toThrow();
    expect(env.ok).toBe(true);
    expect((env as { data: typeof r }).data).toEqual(r);
    expect((env as { exit_code: number }).exit_code).toBe(0);
  });
  it('produces a valid `ok: true` envelope with exit_code 1 when any check fails', () => {
    const r = { all_passed: false, checks: [{ category: 'environment' as const, name: 'node', status: 'fail' as const }] };
    const env = doctorCommand.mapResult!(r);
    expect(() => validateEnvelope(env)).not.toThrow();
    expect(env.ok).toBe(true);
    expect((env as { data: typeof r }).data).toEqual(r);
    expect((env as { exit_code: number }).exit_code).toBe(1);
  });
});

describe('plugin-aware doctor checks', () => {
  let home: string;
  beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc-')); });
  afterEach(async () => { await fs.rm(home, { recursive: true, force: true }); });

  it('reports bootstrap status, UI PID consistency, and version skew', async () => {
    // Fresh home — bootstrap missing
    let result = await runPluginChecks({ root: home, localVersion: '1.1.0' });
    expect(result.find((c) => c.name === 'bootstrap-skeleton')?.status).toBe('fail');
    expect(result.find((c) => c.name === 'version-skew')?.status).toBe('pass'); // no install.json yet
    expect(result.find((c) => c.name === 'ui-pid-consistency')?.status).toBe('pass'); // no pid file

    // Bootstrap manually
    await fs.mkdir(path.join(home, 'projects'), { recursive: true });
    await fs.writeFile(path.join(home, 'registry.yml'), 'repos: []\nworkspaces: []\n');
    await fs.writeFile(path.join(home, 'config.yml'), 'default_active_harness: claude\n');
    await fs.writeFile(path.join(home, 'install.json'), JSON.stringify({
      package_version: '1.1.0',
      installed_at: '2026-05-08T00:00:00.000Z',
      last_writer_version: '1.5.0',
      state_schema_version: 'v5',
    }));
    result = await runPluginChecks({ root: home, localVersion: '1.1.0' });
    expect(result.find((c) => c.name === 'bootstrap-skeleton')?.status).toBe('pass');
    expect(result.find((c) => c.name === 'version-skew')?.status).toBe('fail');

    // Stale PID file — process is dead
    await fs.mkdir(path.join(home, 'runtime'), { recursive: true });
    await fs.writeFile(
      path.join(home, 'runtime', 'ui.pid'),
      JSON.stringify({ pid: 999997, port: 3000, started_at: new Date().toISOString() }),
    );
    result = await runPluginChecks({ root: home, localVersion: '1.5.0' });
    expect(result.find((c) => c.name === 'ui-pid-consistency')?.status).toBe('warn');
  });

  it('bundle-integrity: warns when CLAUDE_PLUGIN_ROOT is unset', async () => {
    const result = await runPluginChecks({ root: home, localVersion: '1.0.0' });
    const bi = result.find((c) => c.name === 'bundle-integrity');
    expect(bi?.status).toBe('warn');
    expect(bi?.detail).toMatch(/CLAUDE_PLUGIN_ROOT not set/);
  });

  it('bundle-integrity: passes when bundle exists at CLAUDE_PLUGIN_ROOT', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      // The CLI bundle now lives inside the rad-orchestration skill folder.
      const scriptsDir = path.join(pluginRoot, 'skills', 'rad-orchestration', 'scripts');
      await fs.mkdir(scriptsDir, { recursive: true });
      await fs.writeFile(path.join(scriptsDir, 'radorch.mjs'), '// stub bundle');
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      expect(result.find((c) => c.name === 'bundle-integrity')?.status).toBe('pass');
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('bundle-integrity: fails when bundle is missing under a configured CLAUDE_PLUGIN_ROOT', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      const bi = result.find((c) => c.name === 'bundle-integrity');
      expect(bi?.status).toBe('fail');
      expect(bi?.detail).toMatch(/missing/);
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('does not throw when install.json lacks last_writer_version (iter-01 install)', async () => {
    const homeIter01 = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doctor-iter01-'));
    try {
      // Pre-iter-02 install.json shape: only package_version + installed_at, no last_writer_version
      await fs.mkdir(homeIter01, { recursive: true });
      await fs.writeFile(
        path.join(homeIter01, 'install.json'),
        JSON.stringify({ package_version: '1.0.0-alpha.7', installed_at: '2026-04-01T00:00:00.000Z' }, null, 2) + '\n',
        'utf8',
      );
      const results = await runPluginChecks({ root: homeIter01, localVersion: '1.0.0-alpha.8' });
      // Must not throw. version-skew check should report a non-fail status (skip/pass/warn — no crash).
      const skew = results.find((r) => r.name === 'version-skew');
      expect(skew).toBeDefined();
      expect(skew?.status).not.toBe('fail');
    } finally {
      await fs.rm(homeIter01, { recursive: true, force: true });
    }
  });
});

describe('runPluginChecks — new plugin-install checks (FR-14)', () => {
  let home: string;
  beforeEach(async () => { home = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc-')); });
  afterEach(async () => { await fs.rm(home, { recursive: true, force: true }); });

  it('projects-base-path-readable passes when the resolved path exists and is readable', async () => {
    // Default base_path resolves to <root>/projects when no orchestration.yml is present.
    await fs.mkdir(path.join(home, 'projects'), { recursive: true });
    const result = await runPluginChecks({ root: home, localVersion: '1.0.0' });
    const check = result.find((c) => c.name === 'projects-base-path-readable');
    expect(check).toBeDefined();
    expect(check?.status).toBe('pass');
    expect(check?.detail).toContain(path.join(home, 'projects'));
  });

  it('plugin-skills-enumerable fails when a plugin-shipped skills/<name>/SKILL.md is missing', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      // Create skills/<name>/ folder but no SKILL.md inside.
      const skillDir = path.join(pluginRoot, 'skills', 'rad-broken');
      await fs.mkdir(skillDir, { recursive: true });
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      const check = result.find((c) => c.name === 'plugin-skills-enumerable');
      expect(check).toBeDefined();
      expect(check?.status).toBe('fail');
      expect(check?.detail).toMatch(/rad-broken/);
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('plugin-agents-resolvable warns when CLAUDE_PLUGIN_ROOT is unset', async () => {
    const result = await runPluginChecks({ root: home, localVersion: '1.0.0' });
    const check = result.find((c) => c.name === 'plugin-agents-resolvable');
    expect(check).toBeDefined();
    expect(check?.status).toBe('warn');
    expect(check?.detail).toMatch(/CLAUDE_PLUGIN_ROOT not set/);
  });

  it('cross-install-version-skew warns when both an iter-01 npm-installed radorch and the plugin CLI report different versions', async () => {
    const result = await runPluginChecks({
      root: home,
      localVersion: '1.5.0',
      iter01Version: '1.0.0',
    });
    const check = result.find((c) => c.name === 'cross-install-version-skew');
    expect(check).toBeDefined();
    expect(check?.status).toBe('warn');
    expect(check?.detail).toMatch(/1\.0\.0/);
    expect(check?.detail).toMatch(/1\.5\.0/);
  });

  it('plugin-agents-resolvable fails when agents/ is empty', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      await fs.mkdir(path.join(pluginRoot, 'agents'), { recursive: true });
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      const check = result.find((c) => c.name === 'plugin-agents-resolvable');
      expect(check).toBeDefined();
      expect(check?.status).toBe('fail');
      expect(check?.detail).toMatch(/no \.md agent files/);
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('plugin-agents-resolvable passes when every .md is readable', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      const agentsDir = path.join(pluginRoot, 'agents');
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(path.join(agentsDir, 'orchestrator.md'), '# stub agent\n');
      await fs.writeFile(path.join(agentsDir, 'coder.md'), '# stub agent\n');
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      const check = result.find((c) => c.name === 'plugin-agents-resolvable');
      expect(check).toBeDefined();
      expect(check?.status).toBe('pass');
      expect(check?.detail).toBeUndefined();
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  // OS-sensitive: stripping read perms is not reliably honored by Windows
  // for the file owner, so vitest's `it.skipIf` keeps Linux/macOS coverage
  // while skipping on win32. The empty-agents/ and per-file-missing cases
  // still cover the main fail branches on every platform.
  it.skipIf(process.platform === 'win32')(
    'plugin-agents-resolvable fails when a listed .md is unreadable',
    async () => {
      const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
      try {
        const agentsDir = path.join(pluginRoot, 'agents');
        await fs.mkdir(agentsDir, { recursive: true });
        const filePath = path.join(agentsDir, 'broken.md');
        await fs.writeFile(filePath, '# stub\n');
        // Strip all read bits.
        await fs.chmod(filePath, 0o000);
        try {
          const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
          const check = result.find((c) => c.name === 'plugin-agents-resolvable');
          expect(check).toBeDefined();
          expect(check?.status).toBe('fail');
          expect(check?.detail).toMatch(/broken\.md/);
        } finally {
          // Restore so afterEach cleanup can recurse.
          await fs.chmod(filePath, 0o644);
        }
      } finally {
        await fs.rm(pluginRoot, { recursive: true, force: true });
      }
    },
  );

  it('plugin-skills-enumerable warns when skills/ is missing', async () => {
    const pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-plug-'));
    try {
      // pluginRoot exists but no skills/ subdirectory.
      const result = await runPluginChecks({ root: home, localVersion: '1.0.0', pluginRoot });
      const check = result.find((c) => c.name === 'plugin-skills-enumerable');
      expect(check).toBeDefined();
      expect(check?.status).toBe('warn');
      expect(check?.detail).toMatch(/skills\/ directory missing/);
    } finally {
      await fs.rm(pluginRoot, { recursive: true, force: true });
    }
  });

  it('runDoctor end-to-end does not throw when no rad-orchestration binary is on PATH', async () => {
    // Force PATH to an empty directory so spawn cannot find rad-orchestration.
    // homedirSpy (outer beforeEach) makes resolveInstallRoot() return tmp/.radorch.
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-empty-path-'));
    try {
      await expect(
        runDoctor({ env: { ...process.env, PATH: emptyDir, Path: emptyDir } }),
      ).resolves.toBeDefined();
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true });
    }
  });
});

describe('doctor: 1.3 canonical checks', () => {
  let tmp13: string;
  let homedirSpy13: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    tmp13 = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-doc13-'));
    homedirSpy13 = vi.spyOn(os, 'homedir').mockReturnValue(tmp13);
  });
  afterEach(async () => {
    homedirSpy13.mockRestore();
    await fs.rm(tmp13, { recursive: true, force: true });
  });

  it('reports retired-properties-present warn when orchestration.yml carries any of the four', async () => {
    // Arrange ~/.radorch/orchestration.yml with `system.orch_root: .claude`.
    const radorchDir = path.join(tmp13, '.radorch');
    await fs.mkdir(radorchDir, { recursive: true });
    await fs.writeFile(
      path.join(radorchDir, 'orchestration.yml'),
      'system:\n  orch_root: .claude\n',
    );
    const r = await runInstallChecks();
    const retired = r.find(c => c.name === 'retired-properties-present');
    expect(retired?.status).toBe('warn');
    expect(retired?.detail).toMatch(/system\.orch_root/);
  });

  it('reports the multi-harness install table', async () => {
    const r = await runPluginChecks({ root: tmp13, localVersion: '1.1.0' });
    const t = r.find(c => c.name === 'multi-harness-install-table');
    expect(t).toBeDefined();
    expect(t!.detail).toMatch(/claude:/);
    expect(t!.detail).toMatch(/claude-plugin:/);
    expect(t!.detail).toMatch(/copilot-vscode:/);
    expect(t!.detail).toMatch(/copilot-cli:/);
  });

  it('table renders one line per install-key with (channel) suffix', async () => {
    // Stage a v6 install.json with all four install-keys present except one.
    const radorchDir = path.join(tmp13, '.radorch');
    await fs.mkdir(radorchDir, { recursive: true });
    await fs.writeFile(
      path.join(radorchDir, 'install.json'),
      JSON.stringify({
        state_schema_version: 'v6',
        harnesses: {
          'claude': { version: '1.0.0-alpha.9', channel: 'legacy-installer', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0-alpha.9' },
          'claude-plugin': { version: '1.0.0-alpha.9', channel: 'plugin', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0-alpha.9' },
          'copilot-cli': { version: '1.0.0-alpha.8', channel: 'legacy-installer', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0-alpha.8' },
        },
      }, null, 2) + '\n',
    );
    const r = await runPluginChecks({ root: tmp13, localVersion: '1.0.0-alpha.9' });
    const t = r.find(c => c.name === 'multi-harness-install-table');
    expect(t).toBeDefined();
    // Each registered install-key appears with version + channel suffix.
    expect(t!.detail).toMatch(/claude: 1\.0\.0-alpha\.9 \(legacy-installer\)/);
    expect(t!.detail).toMatch(/claude-plugin: 1\.0\.0-alpha\.9 \(plugin\)/);
    expect(t!.detail).toMatch(/copilot-cli: 1\.0\.0-alpha\.8 \(legacy-installer\)/);
    // The unregistered copilot-vscode key emits not-installed.
    expect(t!.detail).toMatch(/copilot-vscode: not installed/);
  });

  it('appends a consolidation recommendation when both claude and claude-plugin are present', async () => {
    const radorchDir = path.join(tmp13, '.radorch');
    await fs.mkdir(radorchDir, { recursive: true });
    await fs.writeFile(
      path.join(radorchDir, 'install.json'),
      JSON.stringify({
        state_schema_version: 'v6',
        harnesses: {
          'claude': { version: '1.0.0', channel: 'legacy-installer', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0' },
          'claude-plugin': { version: '1.0.0', channel: 'plugin', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0' },
        },
      }) + '\n',
    );
    const r = await runPluginChecks({ root: tmp13, localVersion: '1.0.0' });
    const t = r.find(c => c.name === 'multi-harness-install-table');
    expect(t!.detail).toMatch(/Both .*claude.* and .*claude-plugin.* are registered/);
    expect(t!.detail).toMatch(/npx rad-orchestration uninstall/);
  });

  it('copilot mutex — only one copilot key present at a time produces a single registered copilot row', async () => {
    // Registered: copilot-cli only. copilot-vscode must render as not installed.
    const radorchDir = path.join(tmp13, '.radorch');
    await fs.mkdir(radorchDir, { recursive: true });
    await fs.writeFile(
      path.join(radorchDir, 'install.json'),
      JSON.stringify({
        state_schema_version: 'v6',
        harnesses: {
          'copilot-cli': { version: '1.0.0', channel: 'legacy-installer', installed_at: '2026-01-01T00:00:00.000Z', last_writer_version: '1.0.0' },
        },
      }) + '\n',
    );
    const r = await runPluginChecks({ root: tmp13, localVersion: '1.0.0' });
    const t = r.find(c => c.name === 'multi-harness-install-table');
    expect(t!.detail).toMatch(/copilot-cli: 1\.0\.0 \(legacy-installer\)/);
    expect(t!.detail).toMatch(/copilot-vscode: not installed/);
  });

  it('templates-folder check passes when four canonical tier files present', async () => {
    // Create ~/.radorch/templates/ with all four canonical tier files.
    const radorchDir = path.join(tmp13, '.radorch');
    const templatesDir = path.join(radorchDir, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });
    for (const tier of ['extra-high', 'high', 'medium', 'low']) {
      await fs.writeFile(path.join(templatesDir, `${tier}.yml`), `# ${tier}\n`);
    }
    const r = await runInstallChecks();
    expect(r.find(c => c.name === 'templates-folder-populated')?.status).toBe('pass');
  });
});

it('doctor renders every check from runDoctor under exactly the four canonical categories (regression guard for dynamic enumeration)', async () => {
  const fakeChecks: CheckResult[] = [
    { category: 'Environment', name: 'env-x', status: 'pass', detail: 'ok' },
    { category: 'Install',     name: 'inst-x', status: 'pass', detail: 'ok' },
    { category: 'Registry',    name: 'reg-x', status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'bundle-integrity',            status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'bootstrap-skeleton',          status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'ui-pid-consistency',          status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'version-skew',                status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'projects-base-path-readable', status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'plugin-skills-enumerable',    status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'plugin-agents-resolvable',    status: 'pass', detail: 'ok' },
    { category: 'Plugin',      name: 'cross-install-version-skew',  status: 'warn', detail: 'iter-01 install not detected' },
  ];
  const out = renderDoctorForTest({ all_passed: true, checks: fakeChecks });
  // Every Plugin-category check name must appear in the rendered output (proves dynamic enumeration over `result.checks`).
  const pluginNames = fakeChecks.filter(c => c.category === 'Plugin').map(c => c.name);
  for (const name of pluginNames) {
    expect(out).toContain(name);
  }
  // Exactly the four canonical category headings render — no new categories, no nested sub-rows.
  const categoryHeadings = [...out.matchAll(/^(Environment|Install|Registry|Plugin)$/gm)].map(m => m[1]);
  expect(categoryHeadings.sort()).toEqual(['Environment', 'Install', 'Plugin', 'Registry']);
});
