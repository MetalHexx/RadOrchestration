// Engine public surface. Each function is harness-blind: no string literal
// for any harness name lives in this folder (NFR-2 is enforced by audit
// in P05). Implementation is filled in by P03-T02 / P03-T03 / P04-T01.

import { readdirSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
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

export function applyBodyTokens(text, bodyTokens) {
  let out = text;
  for (const [find, replace] of Object.entries(bodyTokens ?? {})) {
    out = out.split(find).join(replace);
  }
  return out;
}

export async function clearOutputForAdapter(adapter, outDir) {
  // Stateless: every run starts from scratch for this adapter's subtree.
  // ${...} destination tokens pass through bodies unchanged — engine never
  // substitutes, validates, or warns on them.
  const adapterOut = join(outDir, adapter.name);
  rmSync(join(adapterOut, 'agents'), { recursive: true, force: true });
  rmSync(join(adapterOut, 'skills'), { recursive: true, force: true });
}

function resolveFilename(template, canonicalName) {
  // FR-8: '{name}' is the canonical-name substitution token.
  return template.split('{name}').join(canonicalName);
}

function canonicalAgentName(bodyPath) {
  const base = bodyPath.replace(/.*[\\/]/, '');
  return base.replace(/\.md$/i, '');
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
  const data = await loadYml(ymlPath); // throws with named path on any failure (FR-16, DD-7)
  const body = readFileSync(bodyPath, 'utf8');
  // FR-11 + AD-5: replace the literal token with the yml content wrapped in
  // --- delimiters. Trim trailing newline on the yml block so we emit a
  // single, well-formed frontmatter section.
  const ymlBlock = readFileSync(ymlPath, 'utf8').replace(/\n+$/, '');
  const wrapped = `---\n${ymlBlock}\n---`;
  const substituted = body.split('{{FRONTMATTER}}').join(wrapped);
  const withTokens = applyBodyTokens(substituted, adapter.bodyTokens);
  // Touch `data` so the validated parse is not dead — keeps loadYml in the
  // hot path even when the engine itself doesn't otherwise use the parsed
  // fields (AD-6 strictness depends on this).
  void data;
  const name = canonicalAgentName(bodyPath);
  const filename = resolveFilename(adapter.filenames.agent, name);
  const target = join(outDir, adapter.name, 'agents', filename);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, withTokens);
}

export async function translateSkill({ skillDir, adapter, outDir }) {
  throw new Error('translateSkill not yet implemented');
}

export async function build({ harness } = {}) {
  throw new Error('build not yet implemented');
}
