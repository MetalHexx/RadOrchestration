#!/usr/bin/env node
// build.js — Single entry point for the standard npm installer build.
// Fans the adapter engine output for three harnesses (claude, copilot-vscode,
// copilot-cli) into per-harness staged trees under dist/<harness>/, plus a
// shared top-level dist/ui/ and a synthesized dist/package.json. Fail-fast on
// any step (AD-7).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { emitCliBundle } from '../../shared/build-helpers/emit-cli-bundle.js';
import { emitPipelineBundle } from '../../shared/build-helpers/emit-pipeline-bundle.js';
import { emitUiBundle } from '../../shared/build-helpers/emit-ui-bundle.js';
import { expandTokens } from '../../shared/build-helpers/expand-tokens.js';
import { emitManifest } from './emit-manifest.js';
import { synthesizePackageJson } from './synthesize-package-json.js';

const HARNESSES = ['claude', 'copilot-vscode', 'copilot-cli'];

function step(name, fn) {
  const t0 = Date.now();
  process.stderr.write(`[build:standard] ${name} ...\n`);
  return Promise.resolve(fn()).then((r) => {
    process.stderr.write(`[build:standard] ${name} done (${Date.now() - t0}ms)\n`);
    return r;
  }).catch((err) => {
    throw new Error(`[build:standard] step "${name}" failed: ${err.message}`);
  });
}

/** Per-harness install-root token map. Both copilot variants share ~/.copilot.
 *  Standard installer does NOT apply agent-namespacing (AD-6) — bare agent names
 *  in canonical content survive to the dist/ payload. */
function tokenMapFor(harness) {
  const installRoot = harness === 'claude'
    ? path.join(os.homedir(), '.claude')
    : path.join(os.homedir(), '.copilot');
  return {
    '${SKILLS_ROOT}': path.join(installRoot, 'skills'),
    '${PLUGIN_ROOT}': installRoot,
  };
}

/** @param {{ rootDir: string, skipAdapterEngine?: boolean, skipUiRunner?: boolean,
 *            skipBootstrap?: boolean, greenfieldRel?: string }} opts
 *  `rootDir` is the repo root. `greenfieldRel` (default 'greenfield') names
 *  the relative folder under `rootDir` that hosts the new staged subsystems.
 *  Unit tests construct a synthetic fixture without a `greenfield/` parent,
 *  so they pass `greenfieldRel: '.'` to flatten the layout. */
export async function runBuild(opts) {
  const root = path.resolve(opts.rootDir);
  const greenfieldRel = opts.greenfieldRel ?? 'greenfield';
  const greenfield = path.join(root, greenfieldRel);
  const installerDir = path.join(greenfield, 'harness-installers/standard');
  const out = path.join(installerDir, 'dist');

  // Bootstrap missing sub-package node_modules on first run. Idempotent and
  // fixture-safe (skipped when package.json absent). Opt-out via skipBootstrap.
  if (!opts.skipBootstrap) {
    const BOOTSTRAP_TARGETS = [
      path.join(greenfield, 'harness-installers/shared/build-helpers'),
      path.join(greenfield, 'harness-adapters/engine'),
      path.join(root, 'cli'),
      path.join(root, 'ui'),
    ];
    await step('bootstrap-deps', () => {
      for (const pkgDir of BOOTSTRAP_TARGETS) {
        if (!fs.existsSync(path.join(pkgDir, 'package.json'))) continue;
        if (fs.existsSync(path.join(pkgDir, 'node_modules'))) continue;
        process.stderr.write(`[build:standard] bootstrapping ${path.relative(root, pkgDir)} ...\n`);
        execSync('npm install', { cwd: pkgDir, stdio: 'inherit', shell: process.platform === 'win32' });
      }
    });
  }

  // Step 0 — adapter engine, once per harness. Skipped in unit tests.
  if (!opts.skipAdapterEngine) {
    await step('adapter-engine', () => {
      for (const h of HARNESSES) {
        execSync(`node ${path.posix.join(greenfieldRel, 'harness-adapters/engine/build.js')} --harness=${h}`,
          { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
      }
    });
  }

  await step('clean-output', () => fs.rmSync(out, { recursive: true, force: true }));
  fs.mkdirSync(out, { recursive: true });

  // Per-harness staging: adapter output → dist/<harness>/{agents,skills}/.
  await step('copy-adapter-output', () => {
    for (const h of HARNESSES) {
      const adapterOut = path.join(greenfield, 'harness-adapters/output', h);
      fs.cpSync(path.join(adapterOut, 'agents'), path.join(out, h, 'agents'), { recursive: true });
      fs.cpSync(path.join(adapterOut, 'skills'), path.join(out, h, 'skills'), { recursive: true });
    }
  });

  // Per-harness runtime-config staging: orchestration.yml + four templates.
  await step('copy-runtime-config', () => {
    for (const h of HARNESSES) {
      fs.cpSync(
        path.join(greenfield, 'runtime-config/orchestration.yml'),
        path.join(out, h, 'orchestration.yml'),
      );
      fs.cpSync(
        path.join(greenfield, 'runtime-config/templates'),
        path.join(out, h, 'templates'),
        { recursive: true },
      );
    }
  });

  // Per-harness CLI bundle. cli/ lives at the repo root.
  await step('emit-cli-bundle', async () => {
    for (const h of HARNESSES) {
      await emitCliBundle({
        source: path.join(root, 'cli'),
        target: path.join(out, h, 'skills/rad-orchestration/scripts/radorch.mjs'),
      });
    }
  });

  // Per-harness pipeline bundle (pipeline.js + explode-master-plan.js). v5
  // entries (migrate-to-v5, fix-ghost-v5) retire per the plugin iteration.
  await step('emit-pipeline-bundle', async () => {
    for (const h of HARNESSES) {
      await emitPipelineBundle({
        source: path.join(greenfield, 'harness-files/skills/rad-orchestration/scripts'),
        target: path.join(out, h, 'skills/rad-orchestration/scripts'),
      });
    }
  });

  // Prune TS sources, tests/, package.json, tsconfig.json from per-harness
  // scripts trees. Only runtime artifacts (.js, .mjs, .gitignore) survive.
  await step('prune-scripts-sources', () => {
    const KEEP_EXTENSIONS = new Set(['.js', '.mjs']);
    const KEEP_FILES = new Set(['.gitignore']);
    function pruneDir(dir) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          fs.rmSync(abs, { recursive: true, force: true });
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!KEEP_EXTENSIONS.has(ext) && !KEEP_FILES.has(entry.name)) {
            fs.rmSync(abs, { force: true });
          }
        }
      }
    }
    for (const h of HARNESSES) {
      pruneDir(path.join(out, h, 'skills/rad-orchestration/scripts'));
    }
  });

  // UI bundle ONCE at top-level dist/ui/ — shared across all three harnesses
  // (AD-9). Never duplicated under dist/<harness>/.
  await step('emit-ui-bundle', () => emitUiBundle({
    source: path.join(root, 'ui'),
    target: path.join(out, 'ui'),
    runner: opts.skipUiRunner ? async () => { /* unit-test fast path */ } : undefined,
  }));

  // Per-harness token expansion. Standard installer passes agentNames: [] so
  // NO `rad-orchestration:` namespacing is applied (AD-6). Read from out/<h>/,
  // write through a staging dir to avoid mid-walk read-after-write, then
  // atomically move back over.
  await step('expand-tokens', async () => {
    for (const h of HARNESSES) {
      const hOut = path.join(out, h);
      const tokenMap = tokenMapFor(h);
      const staging = path.join(installerDir, `.expand-staging-${h}`);
      fs.rmSync(staging, { recursive: true, force: true });
      await expandTokens({
        source: path.join(hOut, 'agents'),
        target: path.join(staging, 'agents'),
        tokenMap,
        agentNames: [],
      });
      await expandTokens({
        source: path.join(hOut, 'skills'),
        target: path.join(staging, 'skills'),
        tokenMap,
        agentNames: [],
      });
      fs.rmSync(path.join(hOut, 'agents'), { recursive: true, force: true });
      fs.rmSync(path.join(hOut, 'skills'), { recursive: true, force: true });
      fs.cpSync(path.join(staging, 'agents'), path.join(hOut, 'agents'), { recursive: true });
      fs.cpSync(path.join(staging, 'skills'), path.join(hOut, 'skills'), { recursive: true });
      fs.rmSync(staging, { recursive: true, force: true });
    }
  });

  // Per-harness manifest emission + copy-forward of every prior committed
  // version (so a user installed at any prior version has a clean upgrade
  // path resolvable against the bundled manifests).
  const pkg = JSON.parse(
    fs.readFileSync(path.join(installerDir, 'package.json'), 'utf8'),
  );
  await step('emit-manifest', async () => {
    for (const h of HARNESSES) {
      const manifestDir = path.join(installerDir, 'manifests', h);
      fs.mkdirSync(manifestDir, { recursive: true });
      await emitManifest({
        harnessOutputDir: path.join(out, h),
        harness: h,
        version: pkg.version,
        manifestDir,
      });
      const distManifestDir = path.join(out, h, 'manifests');
      fs.mkdirSync(distManifestDir, { recursive: true });
      for (const f of fs.readdirSync(manifestDir)) {
        if (/^v.+\.json$/.test(f)) {
          fs.copyFileSync(path.join(manifestDir, f), path.join(distManifestDir, f));
        }
      }
    }
  });

  // dist/package.json — synthesized for publish (FR-26, FR-28, AD-17).
  await step('synthesize-package-json', () => synthesizePackageJson({
    sourcePkgPath: path.join(installerDir, 'package.json'),
    outPath: path.join(out, 'package.json'),
  }));
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  runBuild({ rootDir: process.cwd() }).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
