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
  // Shared assets (bin/, ui/) — placed under `root` for the plugin layout,
  // and under `root/shared/` for the legacy layout (sharedRoot vs pluginRoot).
  const sharedBase = opts.layout === 'legacy' ? path.join(root, 'shared') : root;
  const harnessBase = opts.layout === 'legacy' ? path.join(root, 'claude') : root;
  fs.mkdirSync(path.join(sharedBase, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(sharedBase, 'bin', 'radorch.mjs'), '#!/usr/bin/env node\nconsole.log("rad");\n');
  fs.mkdirSync(path.join(sharedBase, 'ui'), { recursive: true });
  fs.writeFileSync(path.join(sharedBase, 'ui', 'server.js'), 'export {};\n');
  fs.mkdirSync(path.join(harnessBase, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(harnessBase, 'agents', 'a.md'), '---\nname: a\n---\nbody\n');
  fs.mkdirSync(path.join(harnessBase, 'skills', 's'), { recursive: true });
  fs.writeFileSync(path.join(harnessBase, 'skills', 's', 'SKILL.md'), '---\nname: s\n---\nbody\n');
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
      { bundlePath: 'bin/radorch.mjs', sourcePath: 'bin/radorch.mjs', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'ui/server.js', sourcePath: 'ui/server.js', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'agents/a.md', sourcePath: 'agents/a.md', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
      { bundlePath: 'skills/s/SKILL.md', sourcePath: 'skills/s/SKILL.md', ownership: 'orchestration-system', version: '0.0.0-test', harness: 'claude' },
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

    // Cross-check install.json content parity modulo the non-deterministic
    // `installed_at` field — every other field must match.
    const legacyIj = JSON.parse(fs.readFileSync(path.join(legacyHome, '.radorch', 'install.json'), 'utf8'));
    const pluginIj = JSON.parse(fs.readFileSync(path.join(pluginHome, '.radorch', 'install.json'), 'utf8'));
    delete legacyIj.installed_at;
    delete pluginIj.installed_at;
    expect(legacyIj).toEqual(pluginIj);
  });
});
