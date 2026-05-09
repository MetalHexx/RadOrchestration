// adapters/run-plugin.js — Per-harness plugin-shape emit. Reads every directory
// under canonical skills/ and every .md file under canonical agents/, plus canonical
// hooks/ for hook scripts, then copies everything to
// cli/dist/marketplaces/<adapter.name>/plugins/rad-orchestration/, stamping
// plugin.json `version` from the version arg.
//
// Skills sourcing: all directories under canonical skills/ at canonicalRoot.
// Agents sourcing: all .md files under canonical agents/ at canonicalRoot.
// Hooks sourcing: canonical hooks/ at canonicalRoot (AD-10). Non-plugin emits via
// adapters/run.js do NOT propagate hooks — only the plugin emit ships the hook trio.
//
// Idempotent within the subdirectories this function owns (`skills/`, `agents/`,
// `hooks/`, `.claude-plugin/`). Sibling subdirs like `bin/`, `dist/`, `ui/`
// populated by the publish-time meta-script's bundle steps are preserved.
// Reuses adapter.skillFrontmatter / adapter.agentFrontmatter for SKILL.md /
// agent .md projection so harness-specific shape is honored.

import fs from 'node:fs';
import path from 'node:path';

function pluginOutputDir(outputRoot, adapterName) {
  return path.join(outputRoot, 'cli', 'dist', 'marketplaces', adapterName, 'plugins', 'rad-orchestration');
}

export async function runAdapterPlugin(adapter, { canonicalRoot, outputRoot, version }) {
  const pluginJsonSourceRoot = path.join(canonicalRoot, 'marketplace', 'plugins', 'rad-orchestration');
  const targetRoot = pluginOutputDir(outputRoot, adapter.name);
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const sub of ['skills', 'agents', 'hooks', '.claude-plugin']) {
    fs.rmSync(path.join(targetRoot, sub), { recursive: true, force: true });
  }

  // Copy .claude-plugin/plugin.json with version stamped.
  const cpSrc = path.join(pluginJsonSourceRoot, '.claude-plugin', 'plugin.json');
  if (fs.existsSync(cpSrc)) {
    const cpDst = path.join(targetRoot, '.claude-plugin', 'plugin.json');
    fs.mkdirSync(path.dirname(cpDst), { recursive: true });
    const obj = JSON.parse(fs.readFileSync(cpSrc, 'utf8'));
    obj.version = version;
    // Per Claude's plugin schema, when skills/ is in conventional location we declare a directory entry.
    if (fs.existsSync(path.join(canonicalRoot, 'skills'))) obj.skills = ['./skills'];
    // Hooks presence check uses canonicalRoot (AD-10: canonical hooks/ is the sole source).
    if (fs.existsSync(path.join(canonicalRoot, 'hooks', 'hooks.json'))) obj.hooks = ['./hooks/hooks.json'];
    // Agents directory — every canonical agent ships in the plugin.
    if (fs.existsSync(path.join(canonicalRoot, 'agents'))) obj.agents = ['./agents'];
    fs.writeFileSync(cpDst, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  }

  // Copy hooks/ from canonical repo root (AD-10: canonical hooks/ is the sole source;
  // non-plugin emits skip hook propagation entirely).
  const hooksSrc = path.join(canonicalRoot, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    fs.cpSync(hooksSrc, path.join(targetRoot, 'hooks'), { recursive: true });
  }

  // Walk every directory under canonical skills/, transform SKILL.md frontmatter
  // via adapter.skillFrontmatter, copy other subfiles verbatim.
  // Pattern mirrors adapters/run.js.
  const skillsSrc = path.join(canonicalRoot, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const skillSrcDir = path.join(skillsSrc, skillName);
      if (!fs.statSync(skillSrcDir).isDirectory()) continue;
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

  // Walk every .md file under canonical agents/, transform frontmatter via
  // adapter.agentFrontmatter (falls back to identity if not defined), emit to
  // <targetRoot>/agents/<agentName>.md.
  const agentsSrc = path.join(canonicalRoot, 'agents');
  if (fs.existsSync(agentsSrc)) {
    const agentsOutDir = path.join(targetRoot, 'agents');
    fs.mkdirSync(agentsOutDir, { recursive: true });
    for (const agentFile of fs.readdirSync(agentsSrc)) {
      if (!agentFile.endsWith('.md')) continue;
      const absSrc = path.join(agentsSrc, agentFile);
      if (fs.statSync(absSrc).isDirectory()) continue;
      const absDest = path.join(agentsOutDir, agentFile);
      const text = fs.readFileSync(absSrc, 'utf8');
      const projectFn = adapter.agentFrontmatter
        ? (fm) => adapter.agentFrontmatter(fm, { adapter })
        : (fm) => fm;
      const projected = projectFrontmatterMin(text, projectFn);
      fs.writeFileSync(absDest, projected, 'utf8');
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
