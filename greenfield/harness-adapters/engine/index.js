// Engine public surface. Each function is harness-blind: no string literal
// for any harness name lives in this folder (NFR-2 is enforced by audit
// in P05). Implementation is filled in by P03-T02 / P03-T03 / P04-T01.

import { readdirSync, readFileSync, existsSync, rmSync, mkdirSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import { join, resolve, dirname, extname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';

// FR-18 + AD-9: engine-owned skip-list. Not adapter-tunable — per-harness
// customization would create surprises where the same fixture lands in one
// bundle but not another.
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next', 'dist', 'dist-bundle']);
const SKIP_FILES = new Set(['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'tsconfig.tsbuildinfo']);
const TEST_FILE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

// Text extensions get bodyToken substitution; everything else is copied verbatim.
const TEXT_EXTS = new Set(['.md', '.txt', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.json', '.yml', '.yaml', '.sh', '.css', '.html']);

function isText(p) {
  return TEXT_EXTS.has(extname(p).toLowerCase());
}

function copyTree(srcDir, destDir, bodyTokens) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      copyTree(join(srcDir, entry.name), join(destDir, entry.name), bodyTokens);
      continue;
    }
    const name = entry.name;
    if (SKIP_FILES.has(name) || TEST_FILE.test(name)) continue;
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    if (isText(srcPath)) {
      const text = readFileSync(srcPath, 'utf8');
      writeFileSync(destPath, applyBodyTokens(text, bodyTokens));
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

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
  const skillName = basename(skillDir);
  const target = join(outDir, adapter.name, 'skills', skillName);
  copyTree(skillDir, target, adapter.bodyTokens);
  // FR-12 + FR-8: ensure the SKILL.md output filename comes from the
  // adapter's `filenames.skill` template. Day-one adapters all resolve to
  // 'SKILL.md', so the verbatim copy is already correct; for templates that
  // resolve to a different name we'd rename here.
  const desired = resolveFilename(adapter.filenames.skill, skillName);
  if (desired !== 'SKILL.md') {
    const fs = await import('node:fs');
    fs.renameSync(join(target, 'SKILL.md'), join(target, desired));
  }
}

export async function build({ harness } = {}) {
  throw new Error('build not yet implemented');
}
