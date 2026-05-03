#!/usr/bin/env node
// scripts/build.js — Dogfood build CLI: run one or every adapter against
// repo-root agents/ and skills/, emitting into each harness's gitignored
// target folder. Same code path as CI and publish.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { discoverAdapters } from '../adapters/discover.js';
import { runAdapter } from '../adapters/run.js';

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

async function main() {
  const opts = parseBuildArgs(process.argv.slice(2));
  const adapters = await discoverAdapters(path.join(repoRoot, 'adapters'));
  const selected = selectAdapters(adapters, opts);
  const version = readVersion();

  for (const adapter of selected) {
    const { agentCount, skillCount } = await runAdapter(adapter, {
      canonicalRoot: repoRoot,
      outputRoot: repoRoot,
      version,
      packageVersion: version,
    });
    console.log(`Built ${adapter.name}: ${agentCount} agents, ${skillCount} skills → ${adapter.targetDir}/`);
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(url.fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(`build failed: ${err.message}`);
    process.exit(1);
  });
}
