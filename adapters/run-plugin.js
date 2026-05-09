// adapters/run-plugin.js — Per-harness plugin-shape emit. Reads canonical
// skills/rad-ui-*/ for UI skills and canonical hooks/ for hook scripts, then
// copies everything to cli/dist/marketplaces/<adapter.name>/plugins/rad-orchestration/,
// stamping plugin.json `version` from the version arg.
//
// Skills sourcing: canonical skills/ at canonicalRoot, filtered to rad-ui-* dirs.
// Hooks sourcing: canonical hooks/ at canonicalRoot (AD-10). Non-plugin emits via
// adapters/run.js do NOT propagate hooks — only the plugin emit ships the hook trio.
//
// Idempotent within the subdirectories this function owns (`skills/`, `hooks/`,
// `.claude-plugin/`). Sibling subdirs like `bin/`, `dist/`, `ui/` populated by
// the publish-time meta-script's bundle steps are preserved.
// Reuses adapter.skillFrontmatter for SKILL.md projection so harness-specific
// shape is honored even though only Claude ships this iteration.

import fs from 'node:fs';
import path from 'node:path';

function pluginOutputDir(outputRoot, adapterName) {
  return path.join(outputRoot, 'cli', 'dist', 'marketplaces', adapterName, 'plugins', 'rad-orchestration');
}

export async function runAdapterPlugin(adapter, { canonicalRoot, outputRoot, version }) {
  const sourceRoot = path.join(canonicalRoot, 'marketplace', 'plugins', 'rad-orchestration');
  const targetRoot = pluginOutputDir(outputRoot, adapter.name);
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const sub of ['skills', 'hooks', '.claude-plugin']) {
    fs.rmSync(path.join(targetRoot, sub), { recursive: true, force: true });
  }

  // Copy .claude-plugin/plugin.json with version stamped.
  const cpSrc = path.join(sourceRoot, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(cpSrc)) {
    const cpDst = path.join(targetRoot, '.claude-plugin', 'plugin.json');
    fs.mkdirSync(path.dirname(cpDst), { recursive: true });
    const obj = JSON.parse(fs.readFileSync(cpSrc, 'utf8'));
    obj.version = version;
    // Per Claude's plugin schema, when skills/ is in conventional location we declare a directory entry.
    if (fs.existsSync(path.join(canonicalRoot, 'skills'))) obj.skills = ['./skills'];
    // Hooks presence check uses canonicalRoot (AD-10: canonical hooks/ is the sole source).
    if (fs.existsSync(path.join(canonicalRoot, 'hooks', 'hooks.json'))) obj.hooks = ['./hooks/hooks.json'];
    // No agents this iteration (AD-13).
    delete obj.agents;
    fs.writeFileSync(cpDst, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  }

  // Copy hooks/ from canonical repo root (AD-10: canonical hooks/ is the sole source;
  // non-plugin emits skip hook propagation entirely).
  const hooksSrc = path.join(canonicalRoot, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    fs.cpSync(hooksSrc, path.join(targetRoot, 'hooks'), { recursive: true });
  }

  // Walk canonical skills/, filter to rad-ui-* entries, transform SKILL.md
  // frontmatter via adapter.skillFrontmatter, copy other subfiles verbatim.
  // Pattern mirrors adapters/run.js. Phase 3 will widen this to full enumeration.
  const skillsSrc = path.join(canonicalRoot, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const skillSrcDir = path.join(skillsSrc, skillName);
      if (!fs.statSync(skillSrcDir).isDirectory()) continue;
      if (!skillName.startsWith('rad-ui-')) continue;
      const skillOutDir = path.join(targetRoot, 'skills', skillName);
      fs.mkdirSync(skillOutDir, { recursive: true });
      for (const child of fs.readdirSync(skillSrcDir)) {
        const absSrc = path.join(skillSrcDir, child);
        const absDest = path.join(skillOutDir, child);
        if (fs.statSync(absSrc).isDirectory()) {
          fs.cpSync(absSrc, absDest, { recursive: true });
          continue;
        }
        if (child === 'SKILL.md') {
          const text = fs.readFileSync(absSrc, 'utf8');
          const projected = projectFrontmatterMin(text, (fm) => adapter.skillFrontmatter(fm, { adapter }));
          fs.writeFileSync(absDest, projected, 'utf8');
        } else {
          fs.copyFileSync(absSrc, absDest);
        }
      }
    }
  }

  // bin/ and dist/ and ui/ are placed by the meta-script (P04-T02), not here.
  return { harness: adapter.name, targetRoot };
}

// Lightweight YAML projection — same shape adapters/run.js uses internally.
function projectFrontmatterMin(text, project) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return text;
  const fm = parseSimpleYaml(m[1]);
  const projected = project(fm) || {};
  return `---\n${stringifySimpleYaml(projected)}---\n${m[2]}`;
}
function parseSimpleYaml(src) {
  const out = {};
  for (const line of src.split(/\r?\n/)) {
    const mm = line.match(/^([\w-]+):\s*(.*)$/);
    if (mm) out[mm[1]] = mm[2];
  }
  return out;
}
function stringifySimpleYaml(fm) {
  let s = '';
  for (const [k, v] of Object.entries(fm)) s += `${k}: ${v}\n`;
  return s;
}
