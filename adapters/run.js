// adapters/run.js — Per-adapter runtime: project frontmatter, copy bodies + subfolders,
// emit per-file metadata stream into a per-version catalog at
// installer/src/<harness>/manifests/v<version>.json.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** @import { Adapter, MetadataStreamEntry } from './types.d.ts' */

/**
 * Computes hex sha256 of a file's bytes. Reads synchronously — file counts
 * are small (hundreds at most) and runAdapter is already sync I/O end-to-end.
 */
function sha256OfFile(absPath) {
  const bytes = fs.readFileSync(absPath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/**
 * Runs one adapter against the canonical source. Writes the bundle to
 * outputRoot/<adapter.targetDir>/ and the per-version metadata manifest to a
 * sibling per-harness catalog at outputRoot/<adapter.name>/manifests/v<version>.json
 * — separating bundle destination (which may be shared across adapters, e.g.
 * .github/) from the manifest location (which must be unique per harness).
 * Each entry in the manifest carries a SHA-256 hash of the emitted file's bytes
 * (post-frontmatter projection for agents/SKILL.md, verbatim for skill subfiles).
 *
 * Uses file copies (not symlinks) for cross-platform parity.
 */
export async function runAdapter(adapter, { canonicalRoot, outputRoot, version, packageVersion }) {
  const verbose = process.env.BUILD_VERBOSE === '1';
  const targetRoot = path.join(outputRoot, adapter.targetDir);
  // Structural scoped wipe — only the two subpaths runAdapter emits into are
  // ever removed. Sibling content under targetRoot (workflows/, instructions
  // files, settings) is structurally untouchable. Hard-coded by design — no
  // configuration knob can widen the wipe surface.
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const sub of ['agents', 'skills']) {
    fs.rmSync(path.join(targetRoot, sub), { recursive: true, force: true });
  }

  /** @type {MetadataStreamEntry[]} */
  const files = [];
  let agentCount = 0;
  let skillCount = 0;

  // Agents
  const agentsSrc = path.join(canonicalRoot, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsOut = path.join(targetRoot, 'agents');
    fs.mkdirSync(agentsOut, { recursive: true });
    for (const entry of fs.readdirSync(agentsSrc)) {
      if (!entry.endsWith('.md')) continue;
      const canonicalName = entry.replace(/\.md$/, '');
      const sourcePath = path.posix.join('agents', entry);
      const text = fs.readFileSync(path.join(agentsSrc, entry), 'utf8');
      const projected = projectFrontmatter(text, (fm) =>
        adapter.agentFrontmatter(fm, { adapter }),
      );
      const outName = adapter.filenameRule({ kind: 'agent', canonicalName });
      const absDest = path.join(agentsOut, outName);
      fs.writeFileSync(absDest, projected, 'utf8');
      const sha256 = sha256OfFile(absDest);
      const bundlePath = path.posix.join('agents', outName);
      files.push({
        bundlePath,
        sourcePath,
        ownership: 'orchestration-system',
        version,
        harness: adapter.name,
        sha256,
      });
      agentCount++;
      if (verbose) console.log(`  ${adapter.name}: ${bundlePath}`);
    }
  }

  // Skills
  const skillsSrc = path.join(canonicalRoot, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const skillSrcDir = path.join(skillsSrc, skillName);
      if (!fs.statSync(skillSrcDir).isDirectory()) continue;
      const skillOutDir = path.join(targetRoot, 'skills', skillName);
      fs.mkdirSync(skillOutDir, { recursive: true });

      // Walk the skill folder; transform SKILL.md frontmatter, copy everything else.
      const walk = (rel) => {
        const absSrc = path.join(skillSrcDir, rel);
        const absDest = path.join(skillOutDir, rel);
        const stat = fs.statSync(absSrc);
        if (stat.isDirectory()) {
          fs.mkdirSync(absDest, { recursive: true });
          for (const child of fs.readdirSync(absSrc)) walk(path.join(rel, child));
          return;
        }
        if (rel === 'SKILL.md') {
          const text = fs.readFileSync(absSrc, 'utf8');
          const projected = projectFrontmatter(text, (fm) =>
            adapter.skillFrontmatter(fm, { adapter }),
          );
          const outName = adapter.filenameRule({ kind: 'skill', canonicalName: skillName });
          const destPath = path.join(skillOutDir, outName);
          fs.writeFileSync(destPath, projected, 'utf8');
          const sha256 = sha256OfFile(destPath);
          const bundlePath = path.posix.join('skills', skillName, outName);
          files.push({
            bundlePath,
            sourcePath: path.posix.join('skills', skillName, 'SKILL.md'),
            ownership: 'orchestration-system',
            version,
            harness: adapter.name,
            sha256,
          });
          skillCount++;
          if (verbose) console.log(`  ${adapter.name}: ${bundlePath}`);
        } else {
          // Skill subfile (scripts/, references/, templates/, etc.) — copy
          // verbatim into the manifest stream. Does NOT count toward
          // skillCount; that field counts distinct skill directories
          // (anchored by SKILL.md). Use fileCount for total file count.
          fs.cpSync(absSrc, absDest);
          const sha256 = sha256OfFile(absDest);
          const bundlePath = path.posix.join('skills', skillName, rel.split(path.sep).join('/'));
          files.push({
            bundlePath,
            sourcePath: path.posix.join('skills', skillName, rel.split(path.sep).join('/')),
            ownership: 'orchestration-system',
            version,
            harness: adapter.name,
            sha256,
          });
          if (verbose) console.log(`  ${adapter.name}: ${bundlePath}`);
        }
      };
      for (const child of fs.readdirSync(skillSrcDir)) walk(child);
    }
  }

  // Per-bundle orchestration.yml rewrite: stamp orch_root + package_version.
  // Targets only the canonical config path; all other YAML fields and all
  // other files in the bundle pass through verbatim (NFR-3, AD-10).
  if (packageVersion !== undefined) {
    const ymlPath = path.join(
      targetRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml',
    );
    rewritePerBundleOrchestrationYml(ymlPath, {
      orchRoot: adapter.targetDir,
      packageVersion,
    });
    // Re-hash the rewritten file in the manifest entry so detect-and-warn
    // works against the as-shipped content.
    const entry = files.find(
      (f) => f.bundlePath === path.posix.join('skills', 'rad-orchestration', 'config', 'orchestration.yml'),
    );
    if (entry) entry.sha256 = sha256OfFile(ymlPath);
  }

  const catalogDir = path.join(outputRoot, adapter.name, 'manifests');
  fs.mkdirSync(catalogDir, { recursive: true });
  fs.writeFileSync(
    path.join(catalogDir, `v${version}.json`),
    JSON.stringify({ harness: adapter.name, version, files }, null, 2) + '\n',
    'utf8',
  );
  // Remove the legacy single-file location if it exists from a prior build —
  // there is one canonical manifest location going forward.
  const legacyManifest = path.join(outputRoot, adapter.name, 'manifest.json');
  if (fs.existsSync(legacyManifest)) {
    fs.rmSync(legacyManifest, { force: true });
  }

  return {
    harness: adapter.name,
    agentCount,
    skillCount,
    fileCount: files.length,
  };
}

// ── Frontmatter helpers (regex-based YAML — no AST parser) ──────────

function projectFrontmatter(text, project) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return text; // no frontmatter — ship body verbatim
  const fm = parseSimpleYaml(match[1]);
  const projected = project(fm) || {};
  return `---\n${stringifySimpleYaml(projected)}---\n${match[2]}`;
}

function parseSimpleYaml(src) {
  const out = {};
  const lines = src.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2];
    if (rest === '') {
      // Block list following.
      const list = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        list.push(lines[j].replace(/^\s+-\s+/, ''));
        j++;
      }
      if (list.length) {
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

function stringifySimpleYaml(fm) {
  let s = '';
  for (const [k, v] of Object.entries(fm)) {
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
 * Rewrites the per-bundle orchestration.yml: sets `system.orch_root` to
 * adapter.targetDir and stamps a new top-level `package_version:` field
 * immediately after the existing `version:` line. All other fields pass
 * through verbatim. No template engine, no AST round-trip — string-level
 * field substitution against the existing simple-YAML output shape.
 *
 * Body-text placeholders ({orch_root}, {skillRoot}, etc.) inside agent
 * and skill markdown bodies are NEVER touched — runtime resolution via
 * detectOrchRoot() is the contract (see NFR-3, AD-10).
 */
function rewritePerBundleOrchestrationYml(absYmlPath, { orchRoot, packageVersion }) {
  if (!fs.existsSync(absYmlPath)) return;
  const text = fs.readFileSync(absYmlPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = [];
  let i = 0;
  let stampedPackageVersion = false;
  while (i < lines.length) {
    const line = lines[i];
    // Top-level `version: "1.0"` — emit, then stamp package_version once
    // immediately after, only if not already present.
    if (!stampedPackageVersion && /^version:\s*/.test(line)) {
      out.push(line);
      // Lookahead: is the next non-blank line already package_version?
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && /^package_version:\s*/.test(lines[j])) {
        // Replace the existing line with a fresh stamp.
        out.push(`package_version: ${packageVersion}`);
        i = j + 1;
        stampedPackageVersion = true;
        continue;
      }
      out.push(`package_version: ${packageVersion}`);
      stampedPackageVersion = true;
      i++;
      continue;
    }
    // `  orch_root: <anything>` under `system:` — rewrite the value only.
    const m = line.match(/^(\s*orch_root:\s*).*$/);
    if (m) {
      out.push(`${m[1]}${orchRoot}`);
      i++;
      continue;
    }
    out.push(line);
    i++;
  }
  // If somehow we never saw a top-level `version:` line, prepend the
  // stamp at the top — keeps behavior deterministic on malformed input.
  const final = stampedPackageVersion
    ? out.join('\n')
    : `package_version: ${packageVersion}\n` + out.join('\n');
  fs.writeFileSync(absYmlPath, final, 'utf8');
}
