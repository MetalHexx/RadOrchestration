import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncSatelliteAndTag } from '../scripts/sync-satellite-and-tag.mjs';

// Real filesystem end-to-end coverage: copyTree and rewriteCatalogRef run at their real defaults.
// Only spawn is injected, so the seam under test is exactly "real files, zero git effects".

const HARNESS_TREES = [
  { src: path.join('harness-installers', 'claude-plugin', 'output'), dest: 'claude-plugin' },
  { src: path.join('harness-installers', 'copilot-cli-plugin', 'output'), dest: 'copilot-cli-plugin' },
  { src: path.join('harness-installers', 'copilot-vscode-plugin', 'output'), dest: 'rad-orc-vscode' },
];

function makeRepoFixture() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-repo-'));
  for (const { src, dest } of HARNESS_TREES) {
    const outputDir = path.join(repoRoot, src);
    fs.mkdirSync(path.join(outputDir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'top.txt'), `top-${dest}\n`);
    fs.writeFileSync(path.join(outputDir, 'nested', 'deep.txt'), `deep-${dest}\n`);
  }
  return repoRoot;
}

function makeSatelliteFixture() {
  const satelliteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-sat-'));
  fs.mkdirSync(path.join(satelliteRoot, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(satelliteRoot, '.github', 'plugin'), { recursive: true });

  // The two catalog shapes as they exist in the real satellite today (pinned in the task
  // handoff): a nested git-subdir Claude entry, and a flat two-entry Copilot catalog.
  const claudeCatalog = {
    plugins: [{
      name: 'rad-orc',
      source: {
        source: 'git-subdir',
        url: 'https://github.com/MetalHexx/rad-orc-marketplace.git',
        ref: 'v1.0.0-alpha.13',
        path: 'claude-plugin',
      },
    }],
  };
  fs.writeFileSync(
    path.join(satelliteRoot, '.claude-plugin', 'marketplace.json'),
    JSON.stringify(claudeCatalog, null, 2) + '\n',
  );

  const copilotCatalog = {
    metadata: { pluginRoot: '.' },
    plugins: [
      { name: 'rad-orc', source: 'copilot-cli-plugin', version: '1.0.0-alpha.13' },
      { name: 'rad-orc-vscode', source: 'rad-orc-vscode', version: '1.0.0-alpha.13' },
    ],
  };
  fs.writeFileSync(
    path.join(satelliteRoot, '.github', 'plugin', 'marketplace.json'),
    JSON.stringify(copilotCatalog, null, 2) + '\n',
  );

  return { satelliteRoot };
}

function makeSpawnRecorder(originUrl) {
  const calls = [];
  const spawn = (cmd, args, opts) => {
    calls.push({ cmd, args, cwd: opts?.cwd });
    if (cmd === 'git' && args[0] === 'remote') return { status: 0, stdout: originUrl + '\n', stderr: '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  return { spawn, calls };
}

test('syncSatelliteAndTag with real copyTree and rewriteCatalogRef lands flat payloads and re-stamped catalogs on disk, proceeding against this satellite\'s public MetalHexx origin', async () => {
  const repoRoot = makeRepoFixture();
  const { satelliteRoot } = makeSatelliteFixture();
  try {
    const { spawn, calls } = makeSpawnRecorder('https://github.com/MetalHexx/rad-orc-marketplace.git');
    const version = '1.0.0-alpha.14';
    const tag = `v${version}`;

    await syncSatelliteAndTag({ repoRoot, satelliteRoot, version, spawn });

    // The three payload trees land directly under the satellite root, no owner segment, nested
    // files intact — asserted together (not one at a time) so a destination-path bug that
    // clobbers a sibling can't hide.
    for (const { dest } of HARNESS_TREES) {
      const destDir = path.join(satelliteRoot, dest);
      assert.strictEqual(fs.readFileSync(path.join(destDir, 'top.txt'), 'utf8'), `top-${dest}\n`);
      assert.strictEqual(fs.readFileSync(path.join(destDir, 'nested', 'deep.txt'), 'utf8'), `deep-${dest}\n`);
    }

    // Claude catalog: source.ref re-stamped, url and path preserved.
    const claudeCatalog = JSON.parse(
      fs.readFileSync(path.join(satelliteRoot, '.claude-plugin', 'marketplace.json'), 'utf8'),
    );
    assert.strictEqual(claudeCatalog.plugins[0].source.ref, tag);
    assert.strictEqual(claudeCatalog.plugins[0].source.url, 'https://github.com/MetalHexx/rad-orc-marketplace.git');
    assert.strictEqual(claudeCatalog.plugins[0].source.path, 'claude-plugin');

    // Copilot catalog: both entries' bare version bumped — this satellite is single-tenant with
    // no owner filter, so a future owner-scoped rewrite would silently stop bumping one of these.
    const copilotCatalog = JSON.parse(
      fs.readFileSync(path.join(satelliteRoot, '.github', 'plugin', 'marketplace.json'), 'utf8'),
    );
    assert.strictEqual(copilotCatalog.plugins[0].version, version);
    assert.strictEqual(copilotCatalog.plugins[0].source, 'copilot-cli-plugin');
    assert.strictEqual(copilotCatalog.plugins[1].version, version);
    assert.strictEqual(copilotCatalog.plugins[1].source, 'rad-orc-vscode');

    // The recorded git sequence runs to completion against the public origin: add/commit in the
    // satellite, tag in both repos, push HEAD+tag in both repos — and nothing reaches a URL
    // beyond what the recorder itself stubs.
    const gitCalls = calls.filter(c => c.cmd === 'git');
    assert.ok(gitCalls.some(c => c.args[0] === 'add' && c.cwd === satelliteRoot));
    assert.ok(gitCalls.some(c => c.args[0] === 'commit' && c.cwd === satelliteRoot));
    const tagCalls = gitCalls.filter(c => c.args[0] === 'tag');
    assert.strictEqual(tagCalls.length, 2);
    assert.ok(tagCalls.some(c => c.cwd === repoRoot && c.args.includes(tag)));
    assert.ok(tagCalls.some(c => c.cwd === satelliteRoot && c.args.includes(tag)));
    const pushCalls = gitCalls.filter(c => c.args[0] === 'push');
    assert.strictEqual(pushCalls.length, 4);
    assert.ok(!calls.some(c => c.args?.some(a => /^https?:\/\//.test(a))));
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(satelliteRoot, { recursive: true, force: true });
  }
});
