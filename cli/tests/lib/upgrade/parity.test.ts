import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { runPluginBootstrap } from '../../../src/commands/plugin-bootstrap/run.js';

function sha256(p: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}
function walk(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const rec = (dir: string, rel: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const r = rel ? path.posix.join(rel, e.name) : e.name;
      if (e.isDirectory()) rec(abs, r); else out[r] = sha256(abs);
    }
  };
  rec(root, '');
  return out;
}

function buildSyntheticBundle(root: string, opts: { layout: 'legacy' | 'plugin' }): { manifestPath: string } {
  // Shared assets are now ui/ only (the CLI moved inside the rad-orchestration
  // skill). For the legacy layout sharedRoot lives at root/shared; for the
  // plugin layout sharedRoot IS the pluginRoot. The CLI under skills/* routes
  // through harnessRoot() to <home>/.claude/skills/..., not ~/.radorch/.
  const sharedBase = opts.layout === 'legacy' ? path.join(root, 'shared') : root;
  const harnessBase = opts.layout === 'legacy' ? path.join(root, 'claude') : root;
  fs.mkdirSync(path.join(sharedBase, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(sharedBase, 'ui', 'server.js'), 'export {};\n');
  fs.mkdirSync(path.join(harnessBase, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(harnessBase, 'agents', 'a.md'), '---\nname: a\n---\nbody\n');
  fs.mkdirSync(path.join(harnessBase, 'skills', 's'), { recursive: true });
  fs.writeFileSync(path.join(harnessBase, 'skills', 's', 'SKILL.md'), '---\nname: s\n---\nbody\n');
  const cliDir = path.join(harnessBase, 'skills', 'rad-orchestration', 'scripts');
  fs.mkdirSync(cliDir, { recursive: true });
  fs.writeFileSync(path.join(cliDir, 'radorch.mjs'), '#!/usr/bin/env node\nconsole.log("rad");\n');
  // Plugin-root package.json so runPluginBootstrap's createRequire can read its version.
  fs.writeFileSync(
    path.join(harnessBase, 'package.json'),
    JSON.stringify({ name: 'rad-orchestration', version: '0.0.0-test' }),
    'utf8',
  );
  const manifestDir = path.join(harnessBase, 'manifests');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifest = {
    version: '0.0.0-test',
    package_version: '0.0.0-test',
    harness: 'claude',
    files: [
      { bundlePath: 'skills/rad-orchestration/scripts/radorch.mjs', destinationPath: '${HARNESS_ROOT}/skills/rad-orchestration/scripts/radorch.mjs', sourcePath: 'skills/rad-orchestration/scripts/radorch.mjs', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'ui/server.js', destinationPath: '${RAD_HOME}/ui/server.js', sourcePath: 'ui/server.js', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'agents/a.md', destinationPath: '${HARNESS_ROOT}/agents/a.md', sourcePath: 'agents/a.md', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'skills/s/SKILL.md', destinationPath: '${HARNESS_ROOT}/skills/s/SKILL.md', sourcePath: 'skills/s/SKILL.md', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
    ],
  };
  const manifestPath = path.join(manifestDir, 'v0.0.0-test.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifestPath };
}

describe('cross-channel parity (NFR-1)', () => {
  it('legacy and plugin bootstraps produce byte-identical ~/.radorch/', async () => {
    const legacyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-legacy-'));
    const pluginHome = fs.mkdtempSync(path.join(os.tmpdir(), 'rad-plugin-'));
    const legacyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-src-'));
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-src-'));
    buildSyntheticBundle(legacyRoot, { layout: 'legacy' });
    buildSyntheticBundle(pluginRoot, { layout: 'plugin' });

    const origHomedir = os.homedir;
    try {
      (os as unknown as { homedir: () => string }).homedir = () => legacyHome;
      await runPluginBootstrap({
        pluginRoot: path.join(legacyRoot, 'claude'),
        sharedRoot: path.join(legacyRoot, 'shared'),
        harness: 'claude',
      });
      (os as unknown as { homedir: () => string }).homedir = () => pluginHome;
      await runPluginBootstrap({ pluginRoot, harness: 'claude' });
    } finally {
      (os as unknown as { homedir: () => string }).homedir = origHomedir;
    }

    const legacyTree = walk(path.join(legacyHome, '.radorch'));
    const pluginTree = walk(path.join(pluginHome, '.radorch'));
    // Exclude logs/install.log — `channel` field intentionally diverges per AD-3.
    delete legacyTree['logs/install.log'];
    delete pluginTree['logs/install.log'];
    // install.json carries a per-run `installed_at` timestamp that cannot be
    // byte-identical across two distinct runs; compare it separately by
    // parsed content minus the timestamp field.
    delete legacyTree['install.json'];
    delete pluginTree['install.json'];
    expect(legacyTree).toEqual(pluginTree);

    // Section 6: install.json content INTENTIONALLY diverges between channels.
    // Legacy writes harnesses.claude with channel=legacy-installer; plugin
    // writes harnesses.claude-plugin with channel=plugin. Parity now means
    // each channel writes a v6 file with a single entry under its own key
    // carrying its own channel value — same delivering version, same
    // last_writer_version.
    const legacyIj = JSON.parse(fs.readFileSync(path.join(legacyHome, '.radorch', 'install.json'), 'utf8'));
    const pluginIj = JSON.parse(fs.readFileSync(path.join(pluginHome, '.radorch', 'install.json'), 'utf8'));
    expect(legacyIj.state_schema_version).toBe('v6');
    expect(pluginIj.state_schema_version).toBe('v6');
    const legacyEntry = legacyIj.harnesses['claude'];
    const pluginEntry = pluginIj.harnesses['claude-plugin'];
    expect(legacyEntry).toBeDefined();
    expect(pluginEntry).toBeDefined();
    expect(legacyEntry.channel).toBe('legacy-installer');
    expect(pluginEntry.channel).toBe('plugin');
    expect(legacyEntry.version).toBe(pluginEntry.version);
    expect(legacyEntry.last_writer_version).toBe(pluginEntry.last_writer_version);
    // The legacy file must not have the plugin's key set (and vice versa).
    expect(legacyIj.harnesses['claude-plugin']).toBeUndefined();
    expect(pluginIj.harnesses['claude']).toBeUndefined();
  });
});
