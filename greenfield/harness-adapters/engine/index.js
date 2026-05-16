// Engine public surface. Each function is harness-blind: no string literal
// for any harness name lives in this folder (NFR-2 is enforced by audit
// in P05). Implementation is filled in by P03-T02 / P03-T03 / P04-T01.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

export async function discoverAdapters(adaptersDir) {
  const entries = readdirSync(adaptersDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'));
  const adapters = [];
  for (const entry of entries) {
    const modPath = resolve(adaptersDir, entry.name, 'adapter.js');
    if (!existsSync(modPath)) {
      throw new Error(`adapter discovery: ${modPath} not found`);
    }
    const mod = await import(pathToFileURL(modPath).href);
    if (!mod.adapter || typeof mod.adapter !== 'object') {
      throw new Error(`adapter discovery: ${modPath} does not export an \`adapter\` object`);
    }
    adapters.push(mod.adapter);
  }
  return adapters;
}

export async function loadYml(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`per-harness yml not found: ${path}`);
  }
  let data;
  try {
    data = YAML.parse(raw);
  } catch (err) {
    throw new Error(`per-harness yml failed to parse: ${path} — ${err.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error(`per-harness yml must be a mapping: ${path}`);
  }
  if (!data.name || String(data.name).trim() === '') {
    throw new Error(`per-harness yml ${path} missing required field: name`);
  }
  if (!data.description || String(data.description).trim() === '') {
    throw new Error(`per-harness yml ${path} missing required field: description`);
  }
  return data;
}

export async function translateAgent({ bodyPath, ymlPath, adapter, outDir }) {
  throw new Error('translateAgent not yet implemented');
}

export async function translateSkill({ skillDir, adapter, outDir }) {
  throw new Error('translateSkill not yet implemented');
}

export async function build({ harness } = {}) {
  throw new Error('build not yet implemented');
}
