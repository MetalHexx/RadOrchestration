#!/usr/bin/env node
// scripts/build.js — Dogfood build CLI: run one or every adapter against
// repo-root agents/ and skills/, emitting into each harness's gitignored
// target folder. Same code path as CI and publish.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';
import { discoverAdapters } from '../adapters/discover.js';
import { runAdapter } from '../adapters/run.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

/** Absolute path to the rad-orchestration scripts folder (bundle source). */
const scriptsDir = path.join(repoRoot, 'skills', 'rad-orchestration', 'scripts');

/**
 * Compiles the pipeline bundle and copies it into the given target path.
 * Preserves the shebang and executable bit.
 *
 * @param {string} destPath - Absolute path to the destination pipeline.js
 */
export function emitPipelineBundle(destPath) {
  execSync(`npm run bundle -- --out=${destPath}`, {
    cwd: scriptsDir,
    stdio: 'pipe',
  });
  try {
    fs.chmodSync(destPath, 0o755);
  } catch {
    // chmod is a no-op on Windows; ignore silently
  }
}

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
 * than one adapter writes to. Two Copilot adapters share `.github/` by design
 * (frontmatter shape is identical at the file path level — the difference is
 * tool-name dictionary and model alias map), and `runAdapter` wipes
 * `<targetDir>/agents/` + `<targetDir>/skills/` before each run, so the final
 * tree only reflects the adapter that ran last.
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

async function main() {
  const opts = parseBuildArgs(process.argv.slice(2));
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  const selected = selectAdapters(adapters, opts);
  const version = readVersion();

  // When the selection covers more than one adapter writing to the same
  // targetDir, surface the collision up-front so contributors know the
  // resulting tree only reflects the last adapter to run. The published
  // installer bundles are not affected — sync-source.js emits each harness
  // into its own installer/src/<harness>/ subfolder.
  const collisions = findCollidingTargetDirs(selected);
  for (const [targetDir, names] of collisions) {
    console.warn(
      `warning: adapters [${names.join(', ')}] all write to ${targetDir}/ — ` +
      `the final tree will only reflect ${names[names.length - 1]} (the last to run). ` +
      `Run a single --harness=<name> if you need a specific projection.`,
    );
  }

  for (const adapter of selected) {
    const { agentCount, skillCount } = await runAdapter(adapter, {
      canonicalRoot: repoRoot,
      outputRoot: repoRoot,
      version,
      packageVersion: version,
    });

    // Compile the pipeline bundle fresh and overwrite the verbatim-copied
    // pipeline.js in this adapter's emit target. This ensures every dogfood
    // target ships the esbuild bundle (pipeline.ts → pipeline.js) rather than
    // whatever bytes happen to be in the canonical scripts/pipeline.js at
    // copy time. (FR-6, AD-5, NFR-2)
    const bundleDest = path.join(
      repoRoot,
      adapter.targetDir,
      'skills', 'rad-orchestration', 'scripts', 'pipeline.js',
    );
    if (fs.existsSync(path.dirname(bundleDest))) {
      emitPipelineBundle(bundleDest);
    }

    console.log(`Built ${adapter.name}: ${agentCount} agents, ${skillCount} skills → ${adapter.targetDir}/`);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
