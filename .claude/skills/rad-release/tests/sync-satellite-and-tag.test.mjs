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

test('syncSatelliteAndTag copies each plugin output into the satellite, updates both catalogs, commits, tags both repos, pushes', async () => {
  const log = [];
  await syncSatelliteAndTag({
    repoRoot: '/repo',
    satelliteRoot: '/sat',
    version: '1.0.0-alpha.10',
    spawn: (cmd, args, opts) => { log.push({ cmd, args, cwd: opts?.cwd }); return { status: 0, stdout: '', stderr: '' }; },
    copyTree: (from, to) => { log.push({ copy: { from, to } }); },
    rewriteCatalogRef: (catPath, ref) => { log.push({ rewrite: { path: catPath, ref } }); },
  });
  // Three plugin payload copies. Build expected destinations with
  // path.join so the assertion is portable across Windows (\) and POSIX (/).
  const copies = log.filter(e => e.copy);
  assert.strictEqual(copies.length, 3);
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'claude-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'copilot-cli-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'copilot-vscode-plugin')));
  // Both catalogs rewritten to the new tag
  const rewrites = log.filter(e => e.rewrite);
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.claude-plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.github', 'plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  // Tag both repos with matching v{X}
  const tagCalls = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'tag');
  assert.strictEqual(tagCalls.length, 2);
  assert.ok(tagCalls.some(t => t.cwd === '/repo' && t.args.includes('v1.0.0-alpha.10')));
  assert.ok(tagCalls.some(t => t.cwd === '/sat' && t.args.includes('v1.0.0-alpha.10')));
  // Pushes — both repos, both tags
  const pushes = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'push');
  assert.ok(pushes.length >= 2);
});

test('defaultRewriteCatalogRef rejects source.source: "git-subdir" missing the url field', () => {
  const p = writeTempCatalog({
    plugins: [{ name: 'x', source: { source: 'git-subdir', ref: 'v0', path: 'x' } }],
  });
  assert.throws(() => defaultRewriteCatalogRef(p, 'v1'), /git-subdir/);
});

test('defaultRewriteCatalogRef rejects source.source: "github" missing the repo field', () => {
  const p = writeTempCatalog({
    plugins: [{ name: 'x', source: { source: 'github', ref: 'v0', path: 'x' } }],
  });
  assert.throws(() => defaultRewriteCatalogRef(p, 'v1'), /github/);
});

test('defaultRewriteCatalogRef rejects unknown source type', () => {
  const p = writeTempCatalog({
    plugins: [{ name: 'x', source: { source: 'unknown', ref: 'v0' } }],
  });
  assert.throws(() => defaultRewriteCatalogRef(p, 'v1'));
});

test('defaultRewriteCatalogRef rewrites ref on a well-formed git-subdir catalog', () => {
  const p = writeTempCatalog({
    plugins: [{
      name: 'x',
      source: { source: 'git-subdir', url: 'https://github.com/a/b.git', ref: 'v0', path: 'x' },
    }],
  });
  defaultRewriteCatalogRef(p, 'v1');
  const after = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(after.plugins[0].source.ref, 'v1');
  assert.strictEqual(after.plugins[0].source.source, 'git-subdir');
  assert.strictEqual(after.plugins[0].source.url, 'https://github.com/a/b.git');
});

test('defaultRewriteCatalogRef rewrites ref on a well-formed source:github catalog (Copilot)', () => {
  const p = writeTempCatalog({
    plugins: [{
      name: 'x',
      source: { source: 'github', repo: 'a/b', ref: 'v0', path: 'x' },
    }],
  });
  defaultRewriteCatalogRef(p, 'v1');
  const after = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.strictEqual(after.plugins[0].source.ref, 'v1');
  assert.strictEqual(after.plugins[0].source.source, 'github');
  assert.strictEqual(after.plugins[0].source.repo, 'a/b');
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
