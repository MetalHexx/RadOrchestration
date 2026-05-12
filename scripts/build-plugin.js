#!/usr/bin/env node
// scripts/build-plugin.js — publish-time meta-script. Drives the full pipeline
// in fixed order: builds CLI, bundles artefacts, runs adapters-plugin (which
// reads canonical skills/rad-ui-*/ and canonical hooks/), then validates and
// syncs the assembled plugin tree to the committed marketplace location.
//
// Steps (FR-2):
//   1. cli-build                cli/ → cli/dist/                     (existing tsc)
//   2. cli-bundle               cli/dist/bin/radorch.js → bundle .mjs (P01-T01)
//   3. pipeline-bundle          skills/.../main.ts → dist/pipeline.js (P01-T02)
//   4. ui-standalone            ui/ → ui/.next/standalone + static    (P01-T03)
//   5. adapters-plugin          run-plugin for every adapter          (P04-T01)
//   6. copy-bundles-into-claude-plugin   stage bundled artifacts into the
//                                CLI-emitted Claude plugin tree
//   7. copy-plugin-package-json copy plugin/package.json into staging dir
//                                so the published npm tarball carries the
//                                manifest (FR-8, AD-7, AD-16)
//   8. sync-plugin-version      plugin.json + package.json version <- cli/package.json
//   9. validate-plugin-tree     structural assertions on the staging plugin
//  10. npm-pack-staging         `npm pack --dry-run --json` size assertion
//                                (NFR-7: ≤ 50 MB unpacked, +10% margin)

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
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
  'copy-manifest-catalog',
  'copy-bundles-into-claude-plugin',
  'copy-plugin-package-json',
  'sync-plugin-version',
  'validate-plugin-tree',
  'npm-pack-staging',
];

const REQUIRED_ARTIFACTS = [
  '.claude-plugin/plugin.json',
  'bin/radorch.mjs',
  'skills/rad-orchestration/scripts/pipeline.js',
  'ui/server.js',
  'hooks/hooks.json',
  // Representative canonical skills (full enumeration via runAdapterPlugin)
  'skills/rad-orchestration/SKILL.md',
  'skills/rad-plan/SKILL.md',
  'skills/rad-ui-start/SKILL.md',
];

/**
 * Returns a sorted list of canonical agent names (filename minus `.md`) from
 * `<canonicalRoot>/agents/`. Used by `validatePluginTree` to enumerate the
 * expected plugin `agents/` tree dynamically rather than relying on a
 * hardcoded representative subset.
 */
function listAgentNames(canonicalRoot) {
  const agentsDir = path.join(canonicalRoot, 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  return fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !fs.statSync(path.join(agentsDir, f)).isDirectory())
    .map((f) => f.replace(/\.md$/, ''))
    .sort();
}

/**
 * Validates the assembled plugin tree at `rootDir`.
 *
 * @param {string} rootDir      - Root of the plugin distribution tree to validate.
 * @param {string} [canonicalRoot] - Repo root from which canonical `agents/` is
 *   read to enumerate expected agent files. Defaults to the module-level
 *   `repoRoot` so callers that know only the plugin dir still get full
 *   agent enumeration without filesystem walking.
 * @param {string} [version]    - Plugin version string (e.g. `'1.1.0'`). When
 *   provided, the per-version manifest catalog entry
 *   `manifests/v<version>.json` is asserted to exist in the plugin tree.
 *
 * Returns `{ ok: boolean, missing: string[] }`.
 *
 * Missing entries use one of two formats:
 *   - `agents/<name>.md`                        — agent file absent from plugin tree
 *   - `agents/orchestrator.md:token:rad-orchestration:<name>` — namespaced dispatch
 *     token absent from plugin orchestrator agent body
 */
export function validatePluginTree(rootDir, canonicalRoot = repoRoot, version) {
  const missing = [];

  // Static artifact checks.
  for (const rel of REQUIRED_ARTIFACTS) {
    const f = path.join(rootDir, rel);
    if (!fs.existsSync(f)) missing.push(rel);
  }

  // Dynamic agent file checks — every canonical agent must ship in agents/.
  const agentNames = listAgentNames(canonicalRoot);
  for (const name of agentNames) {
    const rel = `agents/${name}.md`;
    if (!fs.existsSync(path.join(rootDir, rel))) missing.push(rel);
  }

  // Namespaced-token checks — every non-orchestrator canonical agent that
  // appears as a bare-name dispatch reference in the canonical orchestrator
  // body must show up in the plugin's orchestrator agent body as
  // `rad-orchestration:<name>`. Agents whose bare name is absent from the
  // canonical orchestrator body (e.g. coder-junior / coder-senior, which are
  // dispatched only via @-references in skill bodies) are skipped — the
  // namespacing transform in adapters/run-plugin.js can only rewrite tokens
  // that already exist in the orchestrator dispatch context. Only runs if
  // orchestrator.md is present (absence is already caught by the agent-file
  // check above).
  const orchPath = path.join(rootDir, 'agents', 'orchestrator.md');
  if (fs.existsSync(orchPath)) {
    const orchBody = fs.readFileSync(orchPath, 'utf8');
    const canonOrchPath = path.join(canonicalRoot, 'agents', 'orchestrator.md');
    const canonOrchBody = fs.existsSync(canonOrchPath)
      ? fs.readFileSync(canonOrchPath, 'utf8')
      : '';
    for (const name of agentNames) {
      if (name === 'orchestrator') continue;
      // Skip token assertion when the bare agent name does not appear in any
      // dispatch context in the canonical orchestrator body — applyClaudeNamespacing
      // can only rewrite tokens that already exist there.
      const bareInCanonical = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      if (!bareInCanonical.test(canonOrchBody)) continue;
      const token = `rad-orchestration:${name}`;
      if (!orchBody.includes(token)) {
        missing.push(`agents/orchestrator.md:token:${token}`);
      }
    }
  }

  // Per-version manifest catalog check — manifests/v<version>.json must ship.
  if (version) {
    const manifestRel = `manifests/v${version}.json`;
    if (!fs.existsSync(path.join(rootDir, manifestRel))) missing.push(manifestRel);
  }

  return { ok: missing.length === 0, missing };
}

export function syncPluginVersion(pluginDir, version) {
  const f = path.join(pluginDir, '.claude-plugin', 'plugin.json');
  const obj = JSON.parse(fs.readFileSync(f, 'utf8'));
  obj.version = version;
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n', 'utf8');
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
  const pluginManifest = path.join(repoRoot, 'plugin', 'package.json');
  const exec = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

  await step('cli-build', () => exec('npm run build', path.join(repoRoot, 'cli')));
  await step('cli-bundle', () => {
    const out = path.join(claudeDist, 'bin', 'radorch.mjs');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    exec(`npm run bundle -- --out=${out}`, path.join(repoRoot, 'cli'));
  });
  await step('pipeline-bundle', () => {
    const out = path.join(claudeDist, 'skills', 'rad-orchestration', 'scripts', 'pipeline.js');
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
  await step('copy-manifest-catalog', () => {
    // Plugin manifest emitter (AD-4). Reads the Claude adapter's per-version
    // catalog at <repo>/claude/manifests/, filters out agents/* and skills/*
    // entries (Claude Code handles plugin-folder placement; our bootstrap
    // routes only the shared ~/.radorch/-bound assets), augments with
    // shared-asset entries (bin/, ui/, templates/, scripts/...), then writes
    // the narrowed catalog into the plugin tree.
    const claudeAdapter = adapters.find(a => a.name === 'claude');
    if (!claudeAdapter) return;
    const srcCatalog = path.join(repoRoot, claudeAdapter.name, 'manifests');
    const dstCatalog = path.join(claudeDist, 'manifests');
    fs.mkdirSync(dstCatalog, { recursive: true });
    if (!fs.existsSync(srcCatalog)) return;

    const sha256 = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const walk = (root) => {
      const out = [];
      const rec = (dir, rel) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, e.name);
          const r = rel ? path.posix.join(rel, e.name) : e.name;
          if (e.isDirectory()) rec(abs, r);
          else if (e.isFile()) out.push({ abs, rel: r });
        }
      };
      if (fs.existsSync(root)) rec(root, '');
      return out;
    };

    for (const file of fs.readdirSync(srcCatalog)) {
      if (!file.startsWith('v') || !file.endsWith('.json')) continue;
      const m = JSON.parse(fs.readFileSync(path.join(srcCatalog, file), 'utf8'));
      // Drop agents/* and skills/* (Claude owns these via the plugin folder).
      m.files = m.files.filter(e => !e.bundlePath.startsWith('agents/') && !e.bundlePath.startsWith('skills/'));
      // Re-add the pipeline bundle entry under skills/rad-orchestration/scripts/pipeline.js
      // because that path is shared user-data (ships in ~/.radorch/ via bootstrap).
      const pipelineBundle = path.join(claudeDist, 'skills', 'rad-orchestration', 'scripts', 'pipeline.js');
      if (fs.existsSync(pipelineBundle)) {
        m.files.push({
          bundlePath: 'skills/rad-orchestration/scripts/pipeline.js',
          sourcePath: 'skills/rad-orchestration/scripts/pipeline.js',
          ownership: 'orchestration-system', version: m.version, harness: 'claude',
          sha256: sha256(pipelineBundle),
        });
      }
      // Append shared user-data assets present in the plugin payload.
      for (const { abs, rel } of walk(path.join(claudeDist, 'bin'))) {
        m.files.push({ bundlePath: path.posix.join('bin', rel), sourcePath: path.posix.join('bin', rel),
          ownership: 'orchestration-system', version: m.version, harness: 'claude', sha256: sha256(abs) });
      }
      for (const { abs, rel } of walk(path.join(claudeDist, 'ui'))) {
        m.files.push({ bundlePath: path.posix.join('ui', rel), sourcePath: path.posix.join('ui', rel),
          ownership: 'orchestration-system', version: m.version, harness: 'claude', sha256: sha256(abs) });
      }
      // templates/ lives at skills/rad-orchestration/templates/ in the plugin tree;
      // emit with a short top-level bundlePath so the bootstrap installs them at
      // ~/.radorch/templates/ without the skill-folder prefix.
      for (const { abs, rel } of walk(path.join(claudeDist, 'skills', 'rad-orchestration', 'templates'))) {
        m.files.push({ bundlePath: path.posix.join('templates', rel), sourcePath: path.posix.join('templates', rel),
          ownership: 'orchestration-system', version: m.version, harness: 'claude', sha256: sha256(abs) });
      }
      // orchestration.yml lives at skills/rad-orchestration/config/orchestration.yml;
      // emit with a top-level bundlePath so the bootstrap installs it at ~/.radorch/orchestration.yml.
      const orchYml = path.join(claudeDist, 'skills', 'rad-orchestration', 'config', 'orchestration.yml');
      if (fs.existsSync(orchYml)) {
        m.files.push({ bundlePath: 'orchestration.yml', sourcePath: 'orchestration.yml',
          ownership: 'orchestration-system', version: m.version, harness: 'claude', sha256: sha256(orchYml) });
      }
      fs.writeFileSync(path.join(dstCatalog, file), JSON.stringify(m, null, 2) + '\n', 'utf8');
    }
  });
  await step('copy-bundles-into-claude-plugin', () => {
    // Bundled artifacts were emitted directly into claudeDist by steps 2-4;
    // run-plugin (step 5) only writes skills + hooks + plugin.json, leaving
    // bin/ dist/ ui/ in place. Nothing to do here unless rerun ordering is
    // reversed — kept as a named step for traceability and future moves.
  });
  await step('copy-plugin-package-json', () => {
    // Copy plugin/package.json into the staging tree so the published npm
    // tarball (`npm pack` of claudeDist) carries the manifest. The committed
    // source of truth lives at plugin/package.json; the version is kept in
    // lockstep with cli/package.json by the release flow (FR-8, AD-7, AD-16).
    if (!fs.existsSync(pluginManifest)) {
      throw new Error(`plugin/package.json missing at ${pluginManifest}`);
    }
    fs.mkdirSync(claudeDist, { recursive: true });
    fs.copyFileSync(pluginManifest, path.join(claudeDist, 'package.json'));
  });
  await step('sync-plugin-version', () => syncPluginVersion(claudeDist, version));
  await step('validate-plugin-tree', () => {
    const r = validatePluginTree(claudeDist, repoRoot, version);
    if (!r.ok) {
      process.stderr.write(`[build:plugin] validate-plugin-tree FAIL — missing:\n  ${r.missing.join('\n  ')}\n`);
      process.exit(1);
    }
  });
  await step('npm-pack-staging', () => {
    // NFR-7: tarball unpacked size must stay under 50 MB (with a 10% margin
    // headroom so we catch growth before it hits the hard ceiling).
    const out = execSync('npm pack --dry-run --json', {
      cwd: claudeDist,
      shell: process.platform === 'win32',
      encoding: 'utf8',
    });
    const parsed = JSON.parse(out);
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const unpackedSize = entry?.unpackedSize ?? entry?.size ?? 0;
    const limit = 50 * 1024 * 1024 * 1.1;
    process.stderr.write(
      `[build:plugin] npm-pack-staging unpacked=${unpackedSize} bytes (limit=${Math.round(limit)} bytes)\n`,
    );
    if (unpackedSize > limit) {
      process.stderr.write(
        `[build:plugin] npm-pack-staging FAIL — unpacked size ${unpackedSize} exceeds NFR-7 ceiling of ${Math.round(limit)} bytes (50 MB + 10% margin)\n`,
      );
      process.exit(1);
    }
  });
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    process.stderr.write(`[build:plugin] FAILED: ${err.message}\n`);
    process.exit(1);
  });
}
