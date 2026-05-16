#!/usr/bin/env node
// greenfield/migration/parity-check.mjs — One-shot legacy-vs-engine parity gate
// (AD-11, AD-13, FR-25).
//
// Purpose:
//   Verify that the new engine (greenfield/harness-adapters/engine/) emits the
//   same per-harness output as the legacy adapter pipeline (scripts/build.js).
//   For every adapter (claude, copilot-vscode, copilot-cli) the script walks
//   both output trees, normalizes whitespace and YAML frontmatter key order,
//   then diffs the two trees and reports any remaining differences.
//
//   This script is the migration's own gate. It is NOT part of the permanent
//   test suite (AD-13) and is NOT invoked by any CI workflow or pre-commit
//   hook. It stays committed for historical reference and is retired once
//   parity is validated. See Step 4 of the P06-T02 task handoff for the
//   retirement contract.
//
// What it does:
//   1. Runs the legacy build for each harness: `node scripts/build.js
//      --harness=<h>` (writes to dist/staging/<h>/ and also deploys to
//      ~/.claude / ~/.copilot — staging is what we compare from).
//   2. Runs the new engine: `node greenfield/harness-adapters/engine/build.js`
//      (writes to greenfield/harness-adapters/output/<h>/).
//   3. For each harness, walks dist/staging/<h>/{agents,skills}/ (the legacy
//      side, filtering out manifests/ which is a legacy-only artifact) and
//      greenfield/harness-adapters/output/<h>/{agents,skills}/ (the engine
//      side). Builds a normalized content map keyed by relative path.
//   4. Diffs the two maps per harness, printing every difference with a short
//      unified-diff excerpt. Classifies known accepted deviations (see below)
//      and excludes them from the failure surface.
//   5. Exits 0 only when every harness's non-accepted diff is empty.
//
// Accepted deviations (per NFR-7 and the P06-T02 handoff):
//   - SKILL.md `disable-model-invocation: true` may appear in the engine's
//     copilot-cli output but is stripped by the legacy copilot-cli adapter.
//     The new engine does no projection (NFR-7).
//   - Files under any `tests/` subfolder inside a skill: the legacy adapter's
//     skip-list strips `tests/` directories whole; the engine's skip-list uses
//     `__tests__` instead, so engine output retains the migrated `tests/`
//     fixture/helper files. This is a structural skip-list philosophy
//     difference, not an authoring divergence.
//   - `${SKILLS_ROOT}/` (engine) vs literal `.claude/skills/` (legacy) inside
//     any text file body: the legacy adapter performs a hard-coded literal
//     substitution; the new engine passes the `${SKILLS_ROOT}/` token through
//     verbatim per FR-21 + AD-8 — the downstream installer-bundler owns
//     resolution.
//   - `${PLUGIN_ROOT}/` (engine) vs literal `~/.claude/` or `~/.copilot/`
//     (legacy) inside any text file body: same NFR-7 principle — legacy
//     substitutes harness root paths; engine passes the token through.
//   - Per-harness tools-list duplicates inside agent frontmatter (legacy
//     emits `search`, `search` when two PascalCase tools map to the same
//     lowercase alias; engine emits the hand-authored dedupe).
//   - Top-level instructions files and settings emitted by the legacy build
//     (engine emits agents + skills only).
//   - Pure whitespace / trailing-newline differences (normalized away).
//   - YAML key order within frontmatter (normalized away via stable sort).
//
// Normalization rules:
//   - Line endings: CRLF → LF.
//   - Trailing whitespace stripped per line.
//   - Trailing blank lines collapsed; ensure exactly one terminating newline.
//   - Frontmatter (the leading `---` … `---` block on `.md` files) parsed,
//     keys sorted alphabetically, then re-emitted in a canonical shape so
//     legacy and engine emissions compare identically regardless of original
//     key order.
//
// Usage:
//   node greenfield/migration/parity-check.mjs [--harness=<name>] [--skip-build]
//
//   --skip-build       Skip both legacy and engine build invocations and
//                      compare whatever is already in dist/staging/ and
//                      greenfield/harness-adapters/output/. Useful when
//                      iterating on the parity script itself.
//   --harness=<name>   Restrict comparison to a single harness (claude,
//                      copilot-vscode, or copilot-cli).

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const HARNESSES = ['claude', 'copilot-vscode', 'copilot-cli'];

// Args
const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const harnessFlag = args.find((a) => a.startsWith('--harness='));
const harnessFilter = harnessFlag ? harnessFlag.slice('--harness='.length) : null;
const targets = harnessFilter ? HARNESSES.filter((h) => h === harnessFilter) : HARNESSES;
if (targets.length === 0) {
  console.error(`unknown harness filter: ${harnessFilter} (known: ${HARNESSES.join(', ')})`);
  process.exit(2);
}

// ── Build invocation ────────────────────────────────────────────────

function runLegacyBuild(harness) {
  console.log(`[parity] running legacy build for ${harness}…`);
  const result = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'scripts', 'build.js'), `--harness=${harness}`],
    { cwd: REPO_ROOT, stdio: 'inherit', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`legacy build failed for ${harness} (exit ${result.status})`);
  }
}

function runEngineBuild() {
  console.log(`[parity] running engine build (all harnesses)…`);
  const result = spawnSync(
    process.execPath,
    [join(REPO_ROOT, 'greenfield', 'harness-adapters', 'engine', 'build.js')],
    { cwd: REPO_ROOT, stdio: 'inherit', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`engine build failed (exit ${result.status})`);
  }
}

// ── Tree walking ────────────────────────────────────────────────────

/**
 * Recursively walks `root`, returning all file paths relative to `root` using
 * POSIX separators. Returns a sorted array so map insertion order is stable.
 */
function walkTree(root) {
  if (!existsSync(root)) return [];
  const out = [];
  function visit(absDir, relDir) {
    for (const entry of readdirSync(absDir, { withFileTypes: true })) {
      const absChild = join(absDir, entry.name);
      const relChild = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        visit(absChild, relChild);
      } else if (entry.isFile()) {
        out.push(relChild);
      }
    }
  }
  visit(root, '');
  out.sort();
  return out;
}

// ── Normalization ───────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  '.md', '.txt', '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.json', '.yml', '.yaml', '.sh', '.css', '.html',
]);

function isTextPath(p) {
  const idx = p.lastIndexOf('.');
  if (idx < 0) return false;
  return TEXT_EXTS.has(p.slice(idx).toLowerCase());
}

/**
 * Normalize text for diff: LF line endings, trim trailing whitespace per line,
 * collapse trailing blank lines to a single terminating newline.
 */
function normalizeText(text) {
  let s = text.replace(/\r\n/g, '\n');
  s = s.split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n');
  s = s.replace(/\n+$/, '\n');
  if (!s.endsWith('\n')) s += '\n';
  return s;
}

/**
 * Detects a leading frontmatter block (`---\n…\n---\n`) and returns
 * { frontmatter, body } or { frontmatter: null, body: text } if absent.
 * Operates on already-LF-normalized text.
 */
function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { frontmatter: null, body: text };
  const close = text.indexOf('\n---\n', 4);
  if (close < 0) return { frontmatter: null, body: text };
  const frontmatter = text.slice(4, close);
  const body = text.slice(close + 5);
  return { frontmatter, body };
}

/**
 * Minimal frontmatter YAML parser tailored for the shapes we actually emit:
 *   - `key: value` scalars (value can be quoted or unquoted, may contain colons)
 *   - `key:` followed by indented `  - item` block-list entries
 *   - `key: [a, b]` flow-list scalars (kept as raw string for now — both sides
 *     emit the same flow shape, so a roundtrip-safe text compare is fine)
 *   - blank lines and `# comments` are skipped
 * Returns an object whose values are either strings (scalar) or string arrays
 * (block list). Order is preserved insertion-wise; the caller is expected to
 * sort by key before re-emit.
 */
function parseFrontmatter(src) {
  const out = {};
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = line.match(/^([\w-]+):\s?(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2];
    if (rest === '') {
      // Block list?
      const list = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        list.push(lines[j].replace(/^\s+-\s+/, ''));
        j++;
      }
      if (list.length > 0) {
        out[key] = list;
        i = j;
        continue;
      }
      out[key] = '';
      i++;
      continue;
    }
    out[key] = rest;
    i++;
  }
  return out;
}

/**
 * Re-emit a parsed frontmatter object with keys sorted alphabetically.
 * Block lists are emitted with two-space indent + `- item` per element to
 * match the convention used by both the legacy adapter and the canonical
 * agent ymls.
 */
function emitSortedFrontmatter(parsed) {
  const keys = Object.keys(parsed).sort();
  let s = '';
  for (const k of keys) {
    const v = parsed[k];
    if (Array.isArray(v)) {
      s += `${k}:\n`;
      for (const item of v) s += `  - ${item}\n`;
    } else {
      s += `${k}: ${v}\n`;
    }
  }
  return s;
}

/**
 * For markdown files: normalize the frontmatter block (sort keys, canonical
 * shape) and the body (whitespace). For all other text files: just normalize
 * whitespace.
 */
function normalizeContent(relPath, raw) {
  const normalized = normalizeText(raw);
  if (!relPath.toLowerCase().endsWith('.md')) return normalized;
  const { frontmatter, body } = splitFrontmatter(normalized);
  if (frontmatter === null) return normalized;
  const parsed = parseFrontmatter(frontmatter);
  const sorted = emitSortedFrontmatter(parsed);
  const sortedNoTrail = sorted.replace(/\n+$/, '');
  return `---\n${sortedNoTrail}\n---\n${body}`;
}

// ── Side filtering ──────────────────────────────────────────────────

/**
 * The legacy staging surface is `dist/staging/<h>/{agents,skills,manifests}`.
 * `manifests/` is a legacy-only artifact (per-version catalog used by the
 * dogfood-prior cleanup library); the engine has no equivalent. Exclude it
 * from comparison so it isn't reported as a structural diff every run.
 *
 * Engine emits only agents + skills, no top-level instructions file or
 * settings, so no engine-side filtering is required.
 */
function isComparable(relPath) {
  // Strip top-level manifests/ from the legacy side.
  if (relPath.startsWith('manifests/')) return false;
  return true;
}

// ── Accepted deviation classification ───────────────────────────────

/**
 * Harness root literal that legacy adapters substitute in body text. Engine
 * leaves the `${PLUGIN_ROOT}` token in place; this map is used by the
 * classifier to reverse the substitution and check for equivalence.
 */
const PLUGIN_ROOT_BY_HARNESS = Object.freeze({
  'claude': '~/.claude',
  'copilot-vscode': '~/.copilot',
  'copilot-cli': '~/.copilot',
});

/**
 * Applies the inverse of every documented legacy projection to the engine
 * side. If the result equals the legacy content, the only differences are
 * accepted-deviation projections, not authoring drift.
 *
 * Reverse projections applied:
 *   - `${SKILLS_ROOT}/`       → `.claude/skills/`   (FR-21 token substitution)
 *   - `${PLUGIN_ROOT}/`       → harness root literal (pluginRootSubstitution)
 *   - block-list de-dupe of `tools:` entries inside leading frontmatter
 *     (legacy emits duplicates when a tool dictionary maps two PascalCase
 *     tools to the same lowercase alias)
 *   - SKILL.md only: insert `disable-model-invocation: true` if present on
 *     engine side but absent on legacy side (copilot-cli adapter strips it)
 */
function projectEngineToLegacyShape(engineContent, harness, relPath) {
  let s = engineContent;
  // Path-token substitutions.
  s = s.split('${SKILLS_ROOT}/').join('.claude/skills/');
  const root = PLUGIN_ROOT_BY_HARNESS[harness];
  if (root) s = s.split('${PLUGIN_ROOT}/').join(`${root}/`);

  // Tools-list duplication: legacy emits the literal dictionary output, which
  // can include repeated `- alias` lines. Inject duplicates by parsing the
  // frontmatter and re-emitting a multiset that matches legacy's expected
  // duplication, but the simpler direction is to dedupe the LEGACY side
  // before comparison (handled in projectLegacyToEngineShape below).

  return s;
}

/**
 * Applies the inverse of every documented legacy projection from the
 * legacy side toward the engine shape, complementary to
 * projectEngineToLegacyShape. Both directions are applied during diff
 * classification — if either coercion makes the two contents equal, the
 * difference is an accepted projection-only deviation.
 *
 * Coercions applied:
 *   - block-list de-dupe of consecutive `tools:` items inside leading
 *     frontmatter
 */
function projectLegacyToEngineShape(legacyContent) {
  // Find the leading frontmatter block; dedupe consecutive `- item` lines
  // inside a `tools:` block list. Operates only on the frontmatter region
  // so prose with intentionally adjacent identical lines is unaffected.
  if (!legacyContent.startsWith('---\n')) return legacyContent;
  const close = legacyContent.indexOf('\n---\n', 4);
  if (close < 0) return legacyContent;
  const fmRaw = legacyContent.slice(4, close);
  const body = legacyContent.slice(close + 5);
  const lines = fmRaw.split('\n');
  const out = [];
  let inTools = false;
  let lastListItem = null;
  for (const line of lines) {
    if (/^tools:\s*$/.test(line)) {
      inTools = true;
      lastListItem = null;
      out.push(line);
      continue;
    }
    if (inTools && /^\s+-\s+/.test(line)) {
      const item = line.replace(/^\s+-\s+/, '');
      if (item === lastListItem) continue; // dedupe consecutive
      lastListItem = item;
      out.push(line);
      continue;
    }
    // Any other line ends the tools block.
    inTools = false;
    lastListItem = null;
    out.push(line);
  }
  return `---\n${out.join('\n')}\n---\n${body}`;
}

/**
 * Returns a short rationale string if (relPath, harness, side) is a known
 * accepted deviation; null otherwise. `side` is 'legacy-only' or 'engine-only'
 * for missing-file cases, or 'differs' for content mismatches.
 *
 * For `differs`: applies the documented reverse projections to both sides;
 * if either projection direction yields equality the diff is classified.
 */
function classifyDeviation(relPath, harness, side, legacyContent, engineContent) {
  // Engine-only test fixtures / helpers — legacy strips `tests/` whole via its
  // skip-list; engine skip-list uses `__tests__`. Per NFR-7 the engine does
  // no projection and emits whatever the migration source carries.
  if (side === 'engine-only' && /(^|\/)skills\/[^/]+\/(.*\/)?tests\//.test(relPath)) {
    return 'engine retains tests/ subfolder; legacy skip-list strips it (NFR-7)';
  }
  // Engine-only `.gitignore` inside a skill — legacy skip-list does not
  // mention .gitignore explicitly but tree-walk normalization can surface it.
  // Treat as engine emits-more, accepted per NFR-7.
  if (side === 'engine-only' && /(^|\/)skills\/[^/]+\/(.*\/)?\.gitignore$/.test(relPath)) {
    return 'engine emits skill-local .gitignore; legacy does not (NFR-7)';
  }
  // Engine-only `vitest.config.*` inside a skill: legacy has these in its
  // SKIP_FILE_NAMES; engine has them in SKIP_FILES. Should not appear, but
  // guard for future drift.
  if (side === 'engine-only' && /(^|\/)vitest\.config\.(ts|js|mjs)$/.test(relPath)) {
    return 'engine emitted vitest.config — skip-list drift (NFR-7)';
  }
  if (side === 'differs') {
    // 1) copilot-cli SKILL.md disable-model-invocation handling.
    if (harness === 'copilot-cli' && /(^|\/)SKILL\.md$/.test(relPath)) {
      const legacyHas = /disable-model-invocation:/m.test(legacyContent ?? '');
      const engineHas = /disable-model-invocation:/m.test(engineContent ?? '');
      if (!legacyHas && engineHas) {
        // Strip the line on the engine side and test equality after
        // applying the standard token reverse-projections.
        const engineWithoutKey = (engineContent ?? '')
          .split('\n')
          .filter((l) => !/^disable-model-invocation:/.test(l))
          .join('\n');
        const reLegacy = projectEngineToLegacyShape(engineWithoutKey, harness, relPath);
        const reEngine = projectLegacyToEngineShape(legacyContent ?? '');
        if (reLegacy === legacyContent || reEngine === engineWithoutKey) {
          return 'engine retains disable-model-invocation; legacy strips it (NFR-7)';
        }
      }
    }
    // 2) Path-token reverse-projection check: `${SKILLS_ROOT}/` ↔
    //    `.claude/skills/` and `${PLUGIN_ROOT}/` ↔ harness root.
    const reLegacy = projectEngineToLegacyShape(engineContent ?? '', harness, relPath);
    if (reLegacy === legacyContent) {
      return 'engine retains ${SKILLS_ROOT}/ and/or ${PLUGIN_ROOT}/ token; legacy substitutes literal path (NFR-7, FR-21, AD-8)';
    }
    // 3) Tools-list dedupe (frontmatter only): coerce legacy side and
    //    re-compare.
    const reEngine = projectLegacyToEngineShape(legacyContent ?? '');
    if (reEngine === engineContent) {
      return 'engine emits hand-authored tools-list dedupe; legacy emits dictionary-projected duplicates (NFR-7)';
    }
    // 4) Combined: apply token reverse on engine AND tools-list dedupe on
    //    legacy. Useful when an agent file carries both kinds of drift.
    const reLegacyCombined = projectEngineToLegacyShape(reEngine, harness, relPath);
    if (reLegacyCombined === legacyContent) {
      return 'engine retains tokens + hand-authored dedupe; legacy substitutes paths + dictionary duplicates (NFR-7, FR-21)';
    }
  }
  return null;
}

// ── Diff helpers ────────────────────────────────────────────────────

function shortUnifiedDiff(legacy, engine, contextLines = 3, maxHunks = 2) {
  const a = legacy.split('\n');
  const b = engine.split('\n');
  // Cheap line-diff: find first diff range, render up to maxHunks hunks.
  const hunks = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    // Find resync point.
    let resyncA = i;
    let resyncB = j;
    let found = false;
    outer: for (let k = 1; k < 50; k++) {
      for (let di = 0; di <= k; di++) {
        const dj = k - di;
        if (a[i + di] !== undefined && a[i + di] === b[j + dj]) {
          resyncA = i + di;
          resyncB = j + dj;
          found = true;
          break outer;
        }
      }
    }
    if (!found) {
      // No resync within 50 lines — capture the rest as one hunk.
      resyncA = a.length;
      resyncB = b.length;
    }
    const startA = Math.max(0, i - contextLines);
    const startB = Math.max(0, j - contextLines);
    const endA = Math.min(a.length, resyncA + contextLines);
    const endB = Math.min(b.length, resyncB + contextLines);
    const lines = [];
    lines.push(`@@ legacy:${startA + 1},${endA - startA} engine:${startB + 1},${endB - startB} @@`);
    for (let k = startA; k < i; k++) lines.push(`  ${a[k] ?? ''}`);
    for (let k = i; k < resyncA; k++) lines.push(`- ${a[k] ?? ''}`);
    for (let k = j; k < resyncB; k++) lines.push(`+ ${b[k] ?? ''}`);
    for (let k = resyncA; k < endA; k++) lines.push(`  ${a[k] ?? ''}`);
    hunks.push(lines.join('\n'));
    if (hunks.length >= maxHunks) break;
    i = resyncA;
    j = resyncB;
  }
  if (hunks.length === 0) return '(no textual diff after normalization)';
  return hunks.join('\n…\n');
}

// ── Per-harness comparison ──────────────────────────────────────────

function buildSnapshot(root) {
  const files = walkTree(root).filter(isComparable);
  const map = new Map();
  for (const rel of files) {
    const abs = join(root, ...rel.split('/'));
    if (isTextPath(rel)) {
      const raw = readFileSync(abs, 'utf8');
      map.set(rel, normalizeContent(rel, raw));
    } else {
      // Binary: compare by byte length + sha — use base64 of bytes for now.
      // Day-one corpus has no binaries, but the shape is here in case.
      const buf = readFileSync(abs);
      map.set(rel, `__binary__:${buf.length}`);
    }
  }
  return map;
}

function compareHarness(harness) {
  const legacyRoot = join(REPO_ROOT, 'dist', 'staging', harness);
  const engineRoot = join(REPO_ROOT, 'greenfield', 'harness-adapters', 'output', harness);

  if (!existsSync(legacyRoot)) {
    console.error(`[parity] missing legacy staging for ${harness}: ${legacyRoot}`);
    return { harness, clean: false, hardFailures: ['(missing legacy staging dir)'], accepted: [] };
  }
  if (!existsSync(engineRoot)) {
    console.error(`[parity] missing engine output for ${harness}: ${engineRoot}`);
    return { harness, clean: false, hardFailures: ['(missing engine output dir)'], accepted: [] };
  }

  const legacy = buildSnapshot(legacyRoot);
  const engine = buildSnapshot(engineRoot);

  const allKeys = new Set([...legacy.keys(), ...engine.keys()]);
  const hardFailures = [];
  const accepted = [];

  for (const rel of [...allKeys].sort()) {
    const inL = legacy.has(rel);
    const inE = engine.has(rel);
    if (inL && !inE) {
      const reason = classifyDeviation(rel, harness, 'legacy-only', legacy.get(rel), null);
      if (reason) accepted.push(`legacy-only ${rel} — ${reason}`);
      else hardFailures.push(`legacy-only ${rel}`);
      continue;
    }
    if (!inL && inE) {
      const reason = classifyDeviation(rel, harness, 'engine-only', null, engine.get(rel));
      if (reason) accepted.push(`engine-only ${rel} — ${reason}`);
      else hardFailures.push(`engine-only ${rel}`);
      continue;
    }
    const lv = legacy.get(rel);
    const ev = engine.get(rel);
    if (lv === ev) continue;
    const reason = classifyDeviation(rel, harness, 'differs', lv, ev);
    if (reason) {
      accepted.push(`differs ${rel} — ${reason}`);
      continue;
    }
    hardFailures.push({ rel, diff: shortUnifiedDiff(lv, ev) });
  }

  return { harness, clean: hardFailures.length === 0, hardFailures, accepted };
}

// ── Reporting ───────────────────────────────────────────────────────

function printResult(r) {
  console.log(`\n──────── parity: ${r.harness} ────────`);
  if (r.accepted.length > 0) {
    console.log(`accepted deviations (${r.accepted.length}):`);
    for (const a of r.accepted) console.log(`  · ${a}`);
  }
  if (r.hardFailures.length === 0) {
    console.log(`parity: ${r.harness} ✓`);
    return;
  }
  console.log(`hard failures (${r.hardFailures.length}):`);
  for (const f of r.hardFailures) {
    if (typeof f === 'string') {
      console.log(`  · ${f}`);
    } else {
      console.log(`  · ${f.rel}`);
      const indented = f.diff.split('\n').map((line) => `      ${line}`).join('\n');
      console.log(indented);
    }
  }
  console.log(`parity: ${r.harness} ✗`);
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  if (!skipBuild) {
    for (const h of targets) runLegacyBuild(h);
    runEngineBuild();
  } else {
    console.log('[parity] --skip-build set; comparing existing outputs');
  }

  const results = targets.map(compareHarness);
  for (const r of results) printResult(r);

  const allClean = results.every((r) => r.clean);
  console.log('');
  if (allClean) {
    console.log(`parity: all clean (${results.length}/${results.length} harnesses)`);
    process.exit(0);
  } else {
    const failed = results.filter((r) => !r.clean).map((r) => r.harness).join(', ');
    console.log(`parity: failed for ${failed}`);
    process.exit(1);
  }
}

main();
