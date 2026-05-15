#!/usr/bin/env node
// scripts/build.js — Dogfood build CLI. Stages adapter output into
// dist/staging/<harness>/ and deploys to user-level (~/.claude/, ~/.copilot/)
// via the same manifest-driven library the installer uses.
//
// Inner loop:
//   - npm run build:claude         → ~/.claude/agents/*, ~/.claude/skills/rad-*
//   - npm run build:copilot-vscode → ~/.copilot/...
//   - npm run build:copilot-cli    → ~/.copilot/...
//   - npm run build:all            → every adapter sequentially
//
// No repo-root `.claude/` or `.github/agents,skills/` produced. The CLI bundle
// (radorch.mjs) and the UI standalone are NOT rebuilt here — only agents +
// skills (the high-velocity dogfood surface). For a full rebuild that includes
// CLI + UI + manifest catalogs, run `installer/scripts/sync-source.js` (or
// invoke the installer end-to-end via `npx <tarball>` for a fresh-install
// smoke test).
//
// Manifest-as-source-of-truth: each build saves the manifest it just deployed
// to `dist/dogfood-prior-<harness>.json`. The next build reads that manifest
// and removes its files before writing the new ones. No hardcoded namespace
// knowledge; renamed/deleted rad files get cleaned up automatically.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { discoverAdapters } from '../adapters/discover.js';
import { runAdapter } from '../adapters/run.js';
import { installManifestFiles } from '../installer/lib/install/install-files.js';
import { removeManifestFiles } from '../installer/lib/install/remove-files.js';
import { ensureRuntimeBundled } from '../installer/scripts/sync-source.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** @returns {{ harness: string | null, all: boolean }} */
export function parseBuildArgs(argv) {
  let harness = 'claude';
  let all = false;
  for (const a of argv) {
    if (a === '--all') {
      all = true;
      harness = null;
    } else if (a.startsWith('--harness=')) {
      harness = a.slice('--harness='.length);
    }
  }
  return { harness, all };
}

export function selectAdapters(adapters, { all, harness }) {
  if (all) return adapters;
  const found = adapters.find((a) => a.name === harness);
  if (!found) {
    const known = adapters.map((a) => a.name).join(', ');
    throw new Error(`Unknown harness: ${harness} (known: ${known})`);
  }
  return [found];
}

function readVersion() {
  // Pipeline runtime version — single source of truth for the metadata
  // stream's `version` field — is sourced from the rad-orchestration
  // skill's package.json. Falls back to the installer package.json if the
  // canonical skill folder is absent (e.g., partial clone).
  const pkgPath = path.join(repoRoot, 'skills', 'rad-orchestration', 'scripts', 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {
    const fallback = path.join(repoRoot, 'installer', 'package.json');
    return JSON.parse(fs.readFileSync(fallback, 'utf8')).version;
  }
}

/**
 * Returns a list of [targetDir, adapterNames[]] for any targetDir that more
 * than one adapter writes to. Two Copilot adapters share `.github/` by design.
 * Reported up-front so contributors know that when running `--all`, the
 * user-level deploy (~/.copilot/) only reflects the adapter that ran last.
 * Staging is unaffected — each adapter writes to its own dist/staging/<name>/.
 */
export function findCollidingTargetDirs(adapters) {
  const groups = new Map();
  for (const a of adapters) {
    const list = groups.get(a.targetDir) ?? [];
    list.push(a.name);
    groups.set(a.targetDir, list);
  }
  return [...groups.entries()].filter(([, names]) => names.length > 1);
}

/**
 * Loads the prior dogfood manifest for `<harness>` from
 * `dist/dogfood-prior-<harness>.json`, or returns null on a fresh dogfood
 * (file absent or unreadable).
 */
function loadPriorDogfoodManifest(harness) {
  const priorPath = path.join(repoRoot, 'dist', `dogfood-prior-${harness}.json`);
  if (!fs.existsSync(priorPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(priorPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Persists `manifest` at `dist/dogfood-prior-<harness>.json` so the next build
 * knows what to clean up.
 */
function savePriorDogfoodManifest(harness, manifest) {
  const distDir = path.join(repoRoot, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const priorPath = path.join(distDir, `dogfood-prior-${harness}.json`);
  fs.writeFileSync(priorPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

async function main() {
  const opts = parseBuildArgs(process.argv.slice(2));
  // Ensure every runtime `.ts` entry under skills/rad-orchestration/scripts/
  // has a fresh `.js` bundle alongside it. Idempotent on warm clones; runs
  // once before any adapter staging so the canonical-source copy that lands
  // at ~/.claude/ (or ~/.copilot/) carries the bundles.
  ensureRuntimeBundled(repoRoot);
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  const selected = selectAdapters(adapters, opts);
  const version = readVersion();

  const collisions = findCollidingTargetDirs(selected);
  for (const [targetDir, names] of collisions) {
    console.warn(
      `warning: adapters [${names.join(', ')}] share targetDir ${targetDir}/ — ` +
      `the user-level deploy will only reflect ${names[names.length - 1]} (the last to run). ` +
      `Run a single --harness=<name> if you need a specific projection.`,
    );
  }

  const stagingRoot = path.join(repoRoot, 'dist', 'staging');

  for (const adapter of selected) {
    // Override the adapter's declared targetDir for staging so each harness
    // lands in its own dist/staging/<harness>/ subpath. This avoids the
    // shared-targetDir race (Copilot adapters both declare `.github/`) at the
    // adapter layer. The manifest's destinationPath tokens still drive the
    // final user-level destination during the deploy phase.
    const stagingAdapter = { ...adapter, targetDir: adapter.name };
    const { agentCount, skillCount } = await runAdapter(stagingAdapter, {
      canonicalRoot: repoRoot,
      outputRoot: stagingRoot,
      version,
      packageVersion: version,
    });

    // The fresh manifest is at dist/staging/<harness>/manifests/v<version>.json.
    const manifestPath = path.join(
      stagingRoot, adapter.name, 'manifests', `v${version}.json`,
    );
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Adapter ${adapter.name} did not emit a manifest at ${manifestPath}`);
    }
    const newManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Remove prior dogfood files (manifest-driven; no hardcoded namespaces).
    const prior = loadPriorDogfoodManifest(adapter.name);
    let removedCount = 0;
    if (prior) {
      const result = removeManifestFiles(prior, adapter.name);
      removedCount = result.removedCount ?? 0;
    }

    // Deploy new files to user-level. pluginRoot is the staging dir; the
    // manifest only contains agents+skills entries (runAdapter scope), so
    // installManifestFiles never needs to read from a separate sharedRoot.
    const pluginRoot = path.join(stagingRoot, adapter.name);
    const { copiedCount, skippedCount } = installManifestFiles(
      newManifest, pluginRoot, adapter.name,
    );

    savePriorDogfoodManifest(adapter.name, newManifest);

    console.log(
      `Built ${adapter.name}: ${agentCount} agents, ${skillCount} skills → ` +
      `deployed ${copiedCount} (skipped ${skippedCount}, removed ${removedCount} stale) ` +
      `to user-level`,
    );
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
