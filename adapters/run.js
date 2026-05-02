// adapters/run.js — Per-adapter runtime: project frontmatter, copy bodies + subfolders,
// emit per-file metadata stream as installer/src/<harness>/manifest.json.

import fs from 'node:fs';
import path from 'node:path';

/** @import { Adapter, MetadataStreamEntry } from './types.d.ts' */

/**
 * Runs one adapter against the canonical source. Writes the bundle to
 * outputRoot/<adapter.targetDir>/ and the per-file metadata manifest to a
 * sibling outputRoot/<adapter.name>/manifest.json — separating bundle
 * destination (which may be shared across adapters, e.g. .github/) from the
 * manifest location (which must be unique per harness).
 *
 * Uses file copies (not symlinks) for cross-platform parity.
 */
export async function runAdapter(adapter, { canonicalRoot, outputRoot, version }) {
  const verbose = process.env.BUILD_VERBOSE === '1';
  const targetRoot = path.join(outputRoot, adapter.targetDir);
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });

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
      fs.writeFileSync(path.join(agentsOut, outName), projected, 'utf8');
      const bundlePath = path.posix.join('agents', outName);
      files.push({
        bundlePath,
        sourcePath,
        ownership: 'orchestration-system',
        version,
        harness: adapter.name,
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
          const bundlePath = path.posix.join('skills', skillName, outName);
          files.push({
            bundlePath,
            sourcePath: path.posix.join('skills', skillName, 'SKILL.md'),
            ownership: 'orchestration-system',
            version,
            harness: adapter.name,
          });
          skillCount++;
          if (verbose) console.log(`  ${adapter.name}: ${bundlePath}`);
        } else {
          fs.cpSync(absSrc, absDest);
          const bundlePath = path.posix.join('skills', skillName, rel.split(path.sep).join('/'));
          files.push({
            bundlePath,
            sourcePath: path.posix.join('skills', skillName, rel.split(path.sep).join('/')),
            ownership: 'orchestration-system',
            version,
            harness: adapter.name,
          });
          skillCount++;
          if (verbose) console.log(`  ${adapter.name}: ${bundlePath}`);
        }
      };
      for (const child of fs.readdirSync(skillSrcDir)) walk(child);
    }
  }

  const manifestDir = path.join(outputRoot, adapter.name);
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, 'manifest.json'),
    JSON.stringify({ harness: adapter.name, version, files }, null, 2) + '\n',
    'utf8',
  );

  return {
    harness: adapter.name,
    agentCount,
    skillCount,
    fileCount: files.length,
  };
}

// ── Frontmatter helpers (regex-based YAML — no AST parser) ──────────

function projectFrontmatter(text, project) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
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
