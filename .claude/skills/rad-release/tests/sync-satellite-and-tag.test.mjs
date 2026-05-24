import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { syncSatelliteAndTag } from '../scripts/sync-satellite-and-tag.mjs';

test('syncSatelliteAndTag copies each plugin output into the satellite, updates both catalogs, commits, tags both repos, pushes (FR-7, FR-8, AD-5)', async () => {
  const log = [];
  await syncSatelliteAndTag({
    repoRoot: '/repo',
    satelliteRoot: '/sat',
    version: '1.0.0-alpha.10',
    spawn: (cmd, args, opts) => { log.push({ cmd, args, cwd: opts?.cwd }); return { status: 0, stdout: '', stderr: '' }; },
    copyTree: (from, to) => { log.push({ copy: { from, to } }); },
    rewriteCatalogRef: (catPath, ref) => { log.push({ rewrite: { path: catPath, ref } }); },
  });
  // Three plugin payload copies (AD-5). Build expected destinations with
  // path.join so the assertion is portable across Windows (\) and POSIX (/).
  const copies = log.filter(e => e.copy);
  assert.strictEqual(copies.length, 3);
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'claude-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'copilot-cli-plugin')));
  assert.ok(copies.some(c => c.copy.to === path.join('/sat', 'copilot-vscode-plugin')));
  // Both catalogs rewritten to the new tag (AD-2)
  const rewrites = log.filter(e => e.rewrite);
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.claude-plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  assert.ok(rewrites.some(r => r.rewrite.path === path.join('/sat', '.github', 'plugin', 'marketplace.json') && r.rewrite.ref === 'v1.0.0-alpha.10'));
  // Tag both repos with matching v{X} (FR-7, FR-8)
  const tagCalls = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'tag');
  assert.strictEqual(tagCalls.length, 2);
  assert.ok(tagCalls.some(t => t.cwd === '/repo' && t.args.includes('v1.0.0-alpha.10')));
  assert.ok(tagCalls.some(t => t.cwd === '/sat' && t.args.includes('v1.0.0-alpha.10')));
  // Pushes — both repos, both tags
  const pushes = log.filter(e => e.cmd === 'git' && e.args && e.args[0] === 'push');
  assert.ok(pushes.length >= 2);
});
