#!/usr/bin/env node
// scripts/build-plugin.js — publish-time meta-script. Drives the full pipeline
// in fixed order, then copies the Claude plugin folder to the committed
// marketplace/plugins/rad-orchestration/ location.
//
// Steps (FR-2):
//   1. cli-build              cli/ → cli/dist/                     (existing tsc)
//   2. cli-bundle             cli/dist/bin/radorch.js → bundle .mjs (P01-T01)
//   3. pipeline-bundle        skills/.../main.ts → dist/pipeline.js (P01-T02)
//   4. ui-standalone          ui/ → ui/.next/standalone + static    (P01-T03)
//   5. adapters-plugin        run-plugin for every adapter          (P04-T01)
//   6. copy-bundles-into-claude-plugin   stage bundled artifacts into the
//                              CLI-emitted Claude plugin tree
//   7. sync-plugin-version    plugin.json version <- cli/package.json
//   8. validate-plugin-tree   structural assertions on the committed plugin

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverAdapters } from '../adapters/discover.js';
import { runAdapterPlugin } from '../adapters/run-plugin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
export const PIPELINE_STEPS = [
  'cli-build',
  'cli-bundle',
  'pipeline-bundle',
  'ui-standalone',
  'adapters-plugin',
  'copy-bundles-into-claude-plugin',
  'sync-plugin-version',
  'validate-plugin-tree',
];

const REQUIRED_ARTIFACTS = [
  '.claude-plugin/plugin.json',
  'bin/radorch.mjs',
  'dist/pipeline.js',
  'ui/server.js',
  'hooks/hooks.json',
  'hooks/session-start.sh',
  'hooks/session-start.ps1',
  'skills/ui-start/SKILL.md',
  'skills/ui-stop/SKILL.md',
  'skills/ui-status/SKILL.md',
];

export function validatePluginTree(rootDir) {
  const missing = [];
  for (const rel of REQUIRED_ARTIFACTS) {
    const f = path.join(rootDir, rel);
    if (!fs.existsSync(f)) missing.push(rel);
  }
  return { ok: missing.length === 0, missing };
}

export function syncPluginVersion(pluginDir, version) {
  const f = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  obj.version = version;
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n', 'utf8');

  // Sync version into hook bootstrap scripts so install.json written at
  // session-start always matches the plugin bundle (prevents checkVersionSkew
  // rejecting `ui start` / other commands after a fresh bootstrap).
  const shPath = path.join(pluginDir, 'hooks', 'session-start.sh');
  if (fs.existsSync(shPath)) {
    let sh = fs.readFileSync(shPath, 'utf8');
    sh = sh.replace(/"package_version": "[^"]*"/g, `"package_version": "${version}"`);
    sh = sh.replace(/"last_writer_version": "[^"]*"/g, `"last_writer_version": "${version}"`);
    fs.writeFileSync(shPath, sh, 'utf8');
  }
  const ps1Path = path.join(pluginDir, 'hooks', 'session-start.ps1');
  if (fs.existsSync(ps1Path)) {
    let ps1 = fs.readFileSync(ps1Path, 'utf8');
    ps1 = ps1.replace(/package_version = '[^']*'/g, `package_version = '${version}'`);
    ps1 = ps1.replace(/last_writer_version = '[^']*'/g, `last_writer_version = '${version}'`);
    fs.writeFileSync(ps1Path, ps1, 'utf8');
  }
}

async function step(name, fn) {
  const t0 = Date.now();
  process.stderr.write(`[build:plugin] ${name} ...\n`);
  await fn();
  process.stderr.write(`[build:plugin] ${name} done (${Date.now() - t0}ms)\n`);
}

async function main() {
  const cliPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'cli', 'package.json'), 'utf8'));
  const version = cliPkg.version;
  const claudeDist = path.join(repoRoot, 'cli', 'dist', 'marketplaces', 'claude', 'plugins', 'rad-orchestration');
  const committed = path.join(repoRoot, 'marketplace', 'plugins', 'rad-orchestration');
  const exec = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

  await step('cli-build', () => exec('npm run build', path.join(repoRoot, 'cli')));
  await step('cli-bundle', () => {
    const out = path.join(claudeDist, 'bin', 'radorch.mjs');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    exec(`npm run bundle -- --out=${out}`, path.join(repoRoot, 'cli'));
  });
  await step('pipeline-bundle', () => {
    const out = path.join(claudeDist, 'dist', 'pipeline.js');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    exec(`npm run bundle -- --out=${out}`, path.join(repoRoot, 'skills', 'rad-orchestration', 'scripts'));
  });
  await step('ui-standalone', () => {
    exec('npm run build-standalone', path.join(repoRoot, 'ui'));
    const uiDest = path.join(claudeDist, 'ui');
    fs.rmSync(uiDest, { recursive: true, force: true });
    fs.mkdirSync(uiDest, { recursive: true });
    // Per Next.js standalone deploy layout: copy .next/standalone, .next/static, public.
    const sa = path.join(repoRoot, 'ui', '.next', 'standalone');
    fs.cpSync(sa, uiDest, { recursive: true });
    fs.cpSync(
      path.join(repoRoot, 'ui', '.next', 'static'),
      path.join(uiDest, '.next', 'static'),
      { recursive: true },
    );
    const publicSrc = path.join(repoRoot, 'ui', 'public');
    if (fs.existsSync(publicSrc)) fs.cpSync(publicSrc, path.join(uiDest, 'public'), { recursive: true });
  });
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  await step('adapters-plugin', async () => {
    for (const a of adapters) {
      await runAdapterPlugin(a, { canonicalRoot: repoRoot, outputRoot: repoRoot, version });
    }
  });
  await step('copy-bundles-into-claude-plugin', () => {
    // Bundled artifacts were emitted directly into claudeDist by steps 2-4;
    // run-plugin (step 5) only writes skills + hooks + plugin.json, leaving
    // bin/ dist/ ui/ in place. Nothing to do here unless rerun ordering is
    // reversed — kept as a named step for traceability and future moves.
  });
  await step('sync-plugin-version', () => syncPluginVersion(claudeDist, version));
  await step('validate-plugin-tree', () => {
    const r = validatePluginTree(claudeDist);
    if (!r.ok) {
      process.stderr.write(`[build:plugin] validate-plugin-tree FAIL — missing:\n  ${r.missing.join('\n  ')}\n`);
      process.exit(1);
    }
  });

  // Sync to the committed plugin location (AD-25).
  // Use cpSync with force rather than rmSync+cpSync to avoid Windows EPERM
  // on directories held open by filesystem watchers (e.g. git, Explorer).
  // cpSync with { recursive: true, force: true } overwrites individual files
  // in place, bypassing the rmdir restriction on open directories.
  fs.mkdirSync(committed, { recursive: true });
  fs.cpSync(claudeDist, committed, { recursive: true, force: true });
  process.stderr.write(`[build:plugin] committed plugin synced → ${committed}\n`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    process.stderr.write(`[build:plugin] FAILED: ${err.message}\n`);
    process.exit(1);
  });
}
