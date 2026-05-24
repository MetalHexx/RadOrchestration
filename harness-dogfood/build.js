#!/usr/bin/env node
// harness-dogfood/build.js — Dogfood build CLI. Stages adapter output into
// dist/staging/<harness>/ and deploys to user-level (~/.claude/, ~/.copilot/)
// via the in-folder manifest-driven library.
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
// CLI + UI + manifest catalogs, drive the standard installer's build pipeline.
//
// Manifest-as-source-of-truth: each build saves the manifest it just deployed
// to `dist/dogfood-prior-<harness>.json`. The next build reads that manifest
// and removes its files before writing the new ones. No hardcoded namespace
// knowledge; renamed/deleted rad files get cleaned up automatically.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {
  discoverAdapters,
  clearOutputForAdapter,
  translateAgent,
  translateSkill,
} from '../harness-adapters/engine/index.js';
import { emitManifest } from '../harness-installers/standard/build-scripts/emit-manifest.js';
import { installManifestFiles } from './install-files.js';
import { removeManifestFiles } from './remove-files.js';

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
  // stream's `version` field — is sourced from the standard installer's
  // package.json (the authoritative carrier for the dogfood loop).
  const pkgPath = path.join(repoRoot, 'harness-installers', 'standard', 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
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

  // Pipeline runtime lives in the CLI at
  // `cli/src/lib/pipeline-engine/` and is bundled into installer output by
  // `emit-cli-bundle` (a standard-installer build step), not by the dogfood
  // loop.

  const adaptersRoot = path.join(repoRoot, 'harness-adapters', 'adapters');
  const adapters = await discoverAdapters(adaptersRoot);
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

  const filesRoot = path.join(repoRoot, 'harness-files');
  const stagingRoot = path.join(repoRoot, 'dist', 'staging');
  // Important: manifestDir lives OUTSIDE stagingRoot so (a) emitManifest's
  // recursive walkDir does not pick up a previous run's manifests/v<old>.json
  // as a "file to ship", and (b) the dogfood deploy step never copies a
  // bogus manifests/ folder into ~/.claude/ or ~/.copilot/.
  // clearOutputForAdapter only clears outDir/agents and outDir/skills, so
  // an in-tree manifestDir would survive between builds and re-enter the
  // next manifest.
  const manifestsRoot = path.join(repoRoot, 'dist', 'dogfood-manifests');

  for (const adapter of selected) {
    const outDir = path.join(stagingRoot, adapter.name);
    await clearOutputForAdapter(adapter, stagingRoot);

    const agentsDir = path.join(filesRoot, 'agents');
    const skillsDir = path.join(filesRoot, 'skills');
    const agentBodies = fs.existsSync(agentsDir)
      ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
      : [];
    const skillFolders = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true })
          .filter((e) => e.isDirectory()).map((e) => e.name)
      : [];

    for (const body of agentBodies) {
      const name = body.replace(/\.md$/i, '');
      await translateAgent({
        bodyPath: path.join(agentsDir, body),
        ymlPath: path.join(agentsDir, `${name}.${adapter.name}.yml`),
        adapter,
        outDir: stagingRoot,
      });
    }
    for (const skill of skillFolders) {
      await translateSkill({
        skillDir: path.join(skillsDir, skill),
        adapter,
        outDir: stagingRoot,
      });
    }

    // Emit the per-harness manifest from the freshly staged tree.
    const manifestDir = path.join(manifestsRoot, adapter.name);
    fs.mkdirSync(manifestDir, { recursive: true });
    await emitManifest({
      harnessOutputDir: outDir,
      harness: adapter.name,
      version,
      manifestDir,
    });
    const manifestPath = path.join(manifestDir, `v${version}.json`);
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Adapter ${adapter.name} manifest not emitted at ${manifestPath}`);
    }
    const newManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Manifest-driven deploy as before (now via the in-folder library).
    const prior = loadPriorDogfoodManifest(adapter.name);
    let removedCount = 0;
    if (prior) {
      removedCount = removeManifestFiles(prior, adapter.name).removedCount ?? 0;
    }
    const { copiedCount, skippedCount } = installManifestFiles(newManifest, outDir, adapter.name);
    savePriorDogfoodManifest(adapter.name, newManifest);

    // Counts are derived from what the engine actually staged this run.
    console.log(
      `Built ${adapter.name}: ${agentBodies.length} agents, ${skillFolders.length} skills → ` +
      `deployed ${copiedCount} (skipped ${skippedCount}, removed ${removedCount} stale)`,
    );
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
