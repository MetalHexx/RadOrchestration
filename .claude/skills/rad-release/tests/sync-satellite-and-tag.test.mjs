import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncSatelliteAndTag, defaultRewriteCatalogRef } from '../scripts/sync-satellite-and-tag.mjs';

function writeTempCatalog(body) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-catalog-'));
  const p = path.join(tmp, 'marketplace.json');
  fs.writeFileSync(p, JSON.stringify(body));
  return p;
}

function readCatalog(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

test('syncSatelliteAndTag copies each plugin output into the satellite\'s flat payload directories, updates both catalogs, commits, tags both repos, pushes', async () => {
  const log = [];
  await syncSatelliteAndTag({
    repoRoot: '/repo',
    satelliteRoot: '/sat',
    version: '1.0.0-alpha.10',
    spawn: (cmd, args, opts) => { log.push({ cmd, args, cwd: opts?.cwd }); return { status: 0, stdout: '', stderr: '' }; },
    copyTree: (from, to) => { log.push({ copy: { from, to } }); },
    rewriteCatalogRef: (catPath, ref) => { log.push({ rewrite: { path: catPath, ref } }); },
  });
  // Three plugin payload copies, each replaced wholesale directly at the satellite root — no
  // owner segment. Build expected destinations with path.join so the assertion is portable
  // across Windows (\) and POSIX (/).
  const copies = log.filter(e => e.copy);
  assert.strictEqual(copies.length, 3);
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'claude-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'copilot-cli-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'rad-orc-vscode')));
  // Both catalogs rewritten to the new tag — dropping either write would ship a release where
  // one harness's marketplace listing silently stays on the old version.
  const rewrites = log.filter(e => e.rewrite);
  assert.strictEqual(rewrites.length, 2);
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.claude-plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.github', 'plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  // Tag both repos with matching v{X}
  const tagCalls = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'tag');
  assert.strictEqual(tagCalls.length, 2);
  assert.ok(tagCalls.some(t => t.cwd === '/repo' && t.args.includes('v1.0.0-alpha.10')));
  assert.ok(tagCalls.some(t => t.cwd === '/sat' && t.args.includes('v1.0.0-alpha.10')));
  // Pushes — both repos, both tags
  const pushes = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'push');
  assert.strictEqual(pushes.length, 4);
});

test('syncSatelliteAndTag proceeds against a satellite whose origin is a public github.com/MetalHexx remote', async () => {
  const log = [];
  await syncSatelliteAndTag({
    repoRoot: '/repo',
    satelliteRoot: '/sat',
    version: '1.0.0-alpha.10',
    spawn: (cmd, args, opts) => {
      log.push({ cmd, args, cwd: opts?.cwd });
      if (args[0] === 'remote') return { status: 0, stdout: 'https://github.com/MetalHexx/rad-orc-marketplace.git\n', stderr: '' };
      return { status: 0, stdout: '', stderr: '' };
    },
    copyTree: () => { log.push({ copy: true }); },
    rewriteCatalogRef: () => { log.push({ rewrite: true }); },
  });
  // This satellite is public by design (github.com/MetalHexx/rad-orc-marketplace); the sync
  // runs the full sequence rather than aborting on that origin.
  assert.strictEqual(log.filter(e => e.copy).length, 3);
  assert.strictEqual(log.filter(e => e.rewrite).length, 2);
  const pushes = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'push');
  assert.strictEqual(pushes.length, 4);
});

test('defaultRewriteCatalogRef sets source.ref on a nested git-subdir entry', () => {
  const p = writeTempCatalog({
    plugins: [{
      name: 'rad-orc',
      source: { source: 'git-subdir', url: 'https://github.com/MetalHexx/rad-orc-marketplace.git', ref: 'v0', path: 'claude-plugin' },
    }],
  });
  defaultRewriteCatalogRef(p, 'v1.0.0-alpha.14');
  const after = readCatalog(p);
  assert.strictEqual(after.plugins[0].source.ref, 'v1.0.0-alpha.14');
  assert.strictEqual(after.plugins[0].source.source, 'git-subdir');
  assert.strictEqual(after.plugins[0].source.url, 'https://github.com/MetalHexx/rad-orc-marketplace.git');
});

test('defaultRewriteCatalogRef sets version on a flat-shape entry, stripped of the leading v', () => {
  const p = writeTempCatalog({
    metadata: { pluginRoot: '.' },
    plugins: [{ name: 'rad-orc', source: 'copilot-cli-plugin', version: '0.0.0' }],
  });
  defaultRewriteCatalogRef(p, 'v9.9.9');
  const after = readCatalog(p);
  assert.strictEqual(after.plugins[0].version, '9.9.9');
  assert.strictEqual(after.plugins[0].source, 'copilot-cli-plugin');
});

test('defaultRewriteCatalogRef bumps every flat-shape entry in a catalog — this satellite is single-tenant, no owner filter', () => {
  // Characterization: both Copilot-catalog entries get the new version unconditionally. A
  // future owner-scoped rewrite would silently stop bumping one of these.
  const p = writeTempCatalog({
    metadata: { pluginRoot: '.' },
    plugins: [
      { name: 'rad-orc', source: 'copilot-cli-plugin', version: '1.0.0-alpha.13' },
      { name: 'rad-orc-vscode', source: 'rad-orc-vscode', version: '1.0.0-alpha.13' },
    ],
  });
  defaultRewriteCatalogRef(p, 'v1.0.0-alpha.14');
  const after = readCatalog(p);
  assert.strictEqual(after.plugins[0].version, '1.0.0-alpha.14');
  assert.strictEqual(after.plugins[1].version, '1.0.0-alpha.14');
});

test('defaultRewriteCatalogRef throws on an unrecognized source shape, naming the plugin', () => {
  const p = writeTempCatalog({
    plugins: [{ name: 'mystery-plugin', source: { source: 'github', repo: 'a/b', ref: 'v0' } }],
  });
  assert.throws(() => defaultRewriteCatalogRef(p, 'v1'), /mystery-plugin/);
});

test('defaultRewriteCatalogRef throws on a git-subdir entry missing the url field, naming the plugin', () => {
  const p = writeTempCatalog({
    plugins: [{ name: 'rad-orc', source: { source: 'git-subdir', ref: 'v0', path: 'claude-plugin' } }],
  });
  assert.throws(() => defaultRewriteCatalogRef(p, 'v1'), /rad-orc/);
});

test('syncSatelliteAndTag halts on a non-zero spawn exit and names the failing operation', async () => {
  await assert.rejects(
    () => syncSatelliteAndTag({
      repoRoot: '/repo',
      satelliteRoot: '/sat',
      version: '1.0.0-alpha.10',
      spawn: () => ({ status: 1, stdout: '', stderr: 'simulated git failure' }),
      copyTree: () => {},
      rewriteCatalogRef: () => {},
    }),
    /git|simulated/i,
  );
});
