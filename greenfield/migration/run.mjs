#!/usr/bin/env node
// greenfield/migration/run.mjs — One-shot migration job (AD-11).
//
// Purpose:
//   Populate `greenfield/harness-files/` from the legacy canonical roots
//   at the repo root (`agents/`, `skills/`). This script runs once, by
//   hand, at P06-T01. It is not wired into CI; it is not re-runnable as a
//   regular pipeline step. After successful migration + verification, the
//   discipline is to leave the legacy roots alone (FR-2, AD-11, NFR-6).
//
// What it does:
//   1. Walks /agents/*.md. For each file, strips the leading `---\n…\n---`
//      frontmatter block and writes
//        `greenfield/harness-files/agents/<name>.md`
//      as `{{FRONTMATTER}}\n\n<body>` (FR-19, DD-6). The original
//      frontmatter is held in memory for human reference only — per-harness
//      ymls are hand-authored in step 2 of the task, not emitted here.
//   2. Walks /skills/<skill>/** recursively. For every file, copies it
//      verbatim into greenfield/harness-files/skills/<skill>/... — skill
//      frontmatter stays inline (FR-4, AD-2). The same dev-artifact
//      skip-list the engine uses (FR-18 mirror) is applied at directory
//      traversal time.
//   3. On every text-file copy (`.md`, `.txt`, `.js`, `.mjs`, `.cjs`, `.ts`,
//      `.json`, `.yml`, `.sh`), runs a literal find/replace of
//      `.claude/skills/` → `${SKILLS_ROOT}/` (FR-21). The engine itself
//      does not resolve this token — it passes through to a downstream
//      installer-bundler (AD-8). Other harness references
//      (`.copilot/`, `.github/`, `.agents/`, `~/.radorch/`) are left
//      untouched intentionally — they refer to runtime destinations the
//      author owns, not the canonical skills root.
//
// What it does NOT do:
//   - Does not author per-harness ymls (step 2 of the task; hand-authored).
//   - Does not touch the legacy /agents, /skills, /adapters, /installer,
//     /plugin roots. Step 4 of the task verifies this with git diff.
//   - Does not transform skill frontmatter (FR-4 — engine does no projection;
//     inline frontmatter rides through verbatim to all harnesses).

import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const SRC_AGENTS = join(REPO_ROOT, 'agents');
const SRC_SKILLS = join(REPO_ROOT, 'skills');
const DEST_AGENTS = join(REPO_ROOT, 'greenfield', 'harness-files', 'agents');
const DEST_SKILLS = join(REPO_ROOT, 'greenfield', 'harness-files', 'skills');

// Engine skip-list mirror (FR-18). Keep in lock-step with
// greenfield/harness-adapters/engine/index.js so the migration never copies
// a file the engine would then refuse to translate.
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next', 'dist', 'dist-bundle']);
const SKIP_FILES = new Set(['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'tsconfig.tsbuildinfo']);
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;

const TEXT_EXTS = new Set(['.md', '.txt', '.js', '.mjs', '.cjs', '.ts', '.json', '.yml', '.sh']);

function isTextFile(filePath) {
  return TEXT_EXTS.has(extname(filePath).toLowerCase());
}

// FR-21 tokenization. Literal find/replace, not regex — `.claude/skills/`
// inside a code fence or a path string both convert to `${SKILLS_ROOT}/`.
// Other harness namespaces (`.copilot/`, `.github/`, `.agents/`, `~/.radorch/`)
// are deliberately untouched: they're runtime destinations, not the
// canonical skills root.
function tokenizeBody(text) {
  return text.split('.claude/skills/').join('${SKILLS_ROOT}/');
}

// Strip a leading YAML frontmatter block. Returns { frontmatter, body }
// where `body` excludes the `---\n...\n---\n` delimiters. If no
// frontmatter is present, frontmatter is null and the original text is the
// body.
function splitFrontmatter(text) {
  // Accept either LF or CRLF line endings on the very first delimiter.
  if (!text.startsWith('---')) {
    return { frontmatter: null, body: text };
  }
  // Find the closing --- on its own line after the opening one.
  const afterOpening = text.indexOf('\n', 3);
  if (afterOpening < 0) {
    return { frontmatter: null, body: text };
  }
  const closeRe = /\r?\n---\r?\n/;
  const rest = text.slice(afterOpening + 1);
  const match = rest.match(closeRe);
  if (!match) {
    return { frontmatter: null, body: text };
  }
  const frontmatter = rest.slice(0, match.index);
  const body = rest.slice(match.index + match[0].length);
  return { frontmatter, body };
}

let agentsMigrated = 0;
let skillFilesCopied = 0;
let skillFoldersCopied = 0;

function migrateAgents() {
  mkdirSync(DEST_AGENTS, { recursive: true });
  const entries = readdirSync(SRC_AGENTS, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const srcPath = join(SRC_AGENTS, entry.name);
    const raw = readFileSync(srcPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    if (frontmatter === null) {
      // Defensive: every canonical agent has frontmatter. Surface the
      // anomaly rather than silently coercing.
      throw new Error(`migration: agent file ${srcPath} has no leading frontmatter block — refusing to write a tokenized body without one (FR-19)`);
    }
    // Body may have leading newline(s) already; normalize to a single blank
    // line between `{{FRONTMATTER}}` and the first body line.
    const bodyTrimmedLeading = body.replace(/^\r?\n+/, '');
    const tokenizedBody = tokenizeBody(bodyTrimmedLeading);
    const out = `{{FRONTMATTER}}\n\n${tokenizedBody}`;
    const destPath = join(DEST_AGENTS, entry.name);
    writeFileSync(destPath, out);
    agentsMigrated += 1;
  }
}

function copySkillTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      copySkillTree(join(srcDir, entry.name), join(destDir, entry.name));
      continue;
    }
    if (!entry.isFile()) continue; // symlinks, sockets — skip
    const name = entry.name;
    if (SKIP_FILES.has(name) || TEST_FILE_RE.test(name)) continue;
    const srcPath = join(srcDir, name);
    const destPath = join(destDir, name);
    if (isTextFile(srcPath)) {
      const text = readFileSync(srcPath, 'utf8');
      writeFileSync(destPath, tokenizeBody(text));
    } else {
      copyFileSync(srcPath, destPath);
    }
    skillFilesCopied += 1;
  }
}

function migrateSkills() {
  mkdirSync(DEST_SKILLS, { recursive: true });
  const entries = readdirSync(SRC_SKILLS, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const srcSkillDir = join(SRC_SKILLS, entry.name);
    const destSkillDir = join(DEST_SKILLS, entry.name);
    copySkillTree(srcSkillDir, destSkillDir);
    skillFoldersCopied += 1;
  }
}

function main() {
  if (!existsSync(SRC_AGENTS)) {
    throw new Error(`migration: legacy agents source not found at ${SRC_AGENTS}`);
  }
  if (!existsSync(SRC_SKILLS)) {
    throw new Error(`migration: legacy skills source not found at ${SRC_SKILLS}`);
  }
  console.log(`[migration] source agents: ${relative(REPO_ROOT, SRC_AGENTS)}`);
  console.log(`[migration] source skills: ${relative(REPO_ROOT, SRC_SKILLS)}`);
  console.log(`[migration] dest   agents: ${relative(REPO_ROOT, DEST_AGENTS)}`);
  console.log(`[migration] dest   skills: ${relative(REPO_ROOT, DEST_SKILLS)}`);

  migrateAgents();
  migrateSkills();

  console.log(`[migration] agents migrated: ${agentsMigrated}`);
  console.log(`[migration] skill folders copied: ${skillFoldersCopied}`);
  console.log(`[migration] total skill files copied: ${skillFilesCopied}`);
}

main();
