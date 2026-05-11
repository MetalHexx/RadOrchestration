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

// Test-source files and dev configs that should never ship to end users.
// Mirrored in installer/lib/file-copier.js / manifest.js — keep in sync.
const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/i;
const SKIP_DIR_NAMES = new Set(['tests', 'node_modules', '.next', 'dist', 'dist-bundle']);
const SKIP_FILE_NAMES = new Set([
  'vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs',
  'tsconfig.tsbuildinfo',
]);

function shouldSkipPluginEntry(name, isDir) {
  if (isDir) return SKIP_DIR_NAMES.has(name);
  if (SKIP_FILE_NAMES.has(name)) return true;
  if (TEST_FILE_RE.test(name)) return true;
  return false;
}

function pluginOutputDir(outputRoot, adapterName) {
  return path.join(outputRoot, 'cli', 'dist', 'marketplaces', adapterName, 'plugins', 'rad-orchestration');
}

export async function runAdapterPlugin(adapter, { canonicalRoot, outputRoot, version }) {
  // The .claude-plugin/plugin.json template lives under canonical plugin/ now
  // (P04-T02 — committed marketplace tree retired in favor of npm-pack-of-staging).
  const pluginJsonSourceRoot = path.join(canonicalRoot, 'plugin');
  const targetRoot = pluginOutputDir(outputRoot, adapter.name);
  fs.mkdirSync(targetRoot, { recursive: true });
  for (const sub of ['skills', 'agents', 'hooks', '.claude-plugin']) {
    fs.rmSync(path.join(targetRoot, sub), { recursive: true, force: true });
  }

  // Discover the canonical agent list dynamically (no hardcoded names) for the
  // Claude plugin namespacing pass below. Used only when adapter is Claude.
  const canonicalAgentNames = listCanonicalAgentNames(canonicalRoot);

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
  // non-plugin emits skip hook propagation entirely). Filter out dev-only
  // artifacts so the same shouldSkipPluginEntry policy that gates skill files
  // also applies to hook files (e.g. hooks/session-start.test.mjs must not ship).
  const hooksSrc = path.join(canonicalRoot, 'hooks');
  if (fs.existsSync(hooksSrc)) {
    fs.cpSync(hooksSrc, path.join(targetRoot, 'hooks'), {
      recursive: true,
      filter(source) {
        if (source === hooksSrc) return true;
        const basename = path.basename(source);
        const isDir = fs.statSync(source).isDirectory();
        return !shouldSkipPluginEntry(basename, isDir);
      },
    });
  }

  // Walk every directory under canonical skills/, transform SKILL.md frontmatter
  // via adapter.skillFrontmatter, copy other subfiles verbatim. For Claude
  // adapter, the namespacing pass also runs over every .md body found
  // recursively under each skill folder (e.g. references/*.md) — the
  // orchestrator-facing dispatch tokens live in those reference docs too.
  const skillsSrc = path.join(canonicalRoot, 'skills');
  if (fs.existsSync(skillsSrc)) {
    for (const skillName of fs.readdirSync(skillsSrc)) {
      const skillSrcDir = path.join(skillsSrc, skillName);
      if (!fs.statSync(skillSrcDir).isDirectory()) continue;
      const skillOutDir = path.join(targetRoot, 'skills', skillName);
      fs.mkdirSync(skillOutDir, { recursive: true });

      const walk = (relPath) => {
        const absSrc = path.join(skillSrcDir, relPath);
        const absDest = path.join(skillOutDir, relPath);
        const stat = fs.statSync(absSrc);
        const basename = path.basename(relPath);
        if (shouldSkipPluginEntry(basename, stat.isDirectory())) return;
        if (stat.isDirectory()) {
          fs.mkdirSync(absDest, { recursive: true });
          for (const child of fs.readdirSync(absSrc)) {
            walk(path.join(relPath, child));
          }
          return;
        }
        if (relPath === 'SKILL.md') {
          const text = fs.readFileSync(absSrc, 'utf8');
          const rawProjected = projectFrontmatterMin(text, (fm) => adapter.skillFrontmatter(fm, { adapter }));
          const withPluginRoot = applyPluginRootSubstitution(rawProjected, adapter);
          const projected = applyClaudeNamespacing(withPluginRoot, adapter, canonicalAgentNames);
          fs.writeFileSync(absDest, projected, 'utf8');
          return;
        }
        if (relPath.endsWith('.md')) {
          // Skill reference docs (e.g. references/pipeline-guide.md) carry
          // dispatch tokens that the orchestrator inlines context from. Run
          // the same Claude namespacing pass over their bodies so dispatch
          // references stay consistent in the plugin emit.
          const text = fs.readFileSync(absSrc, 'utf8');
          const projected = applyClaudeNamespacing(text, adapter, canonicalAgentNames);
          fs.writeFileSync(absDest, projected, 'utf8');
          return;
        }
        fs.copyFileSync(absSrc, absDest);
      };
      for (const child of fs.readdirSync(skillSrcDir)) {
        walk(child);
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
      const rawProjected = projectFrontmatterMin(text, projectFn);
      const withPluginRoot = applyPluginRootSubstitution(rawProjected, adapter);
      const projected = applyClaudeNamespacing(withPluginRoot, adapter, canonicalAgentNames);
      fs.writeFileSync(absDest, projected, 'utf8');
    }
  }

  // bin/ and dist/ and ui/ are placed by the meta-script (P04-T02), not here.
  return { harness: adapter.name, targetRoot };
}

// ── Plugin-root substitution ─────────────────────────────────────────

/**
 * Replaces every occurrence of the canonical `${PLUGIN_ROOT}` placeholder in
 * a projected text body with the adapter's harness-specific substitution string.
 * Applied post-frontmatter-projection; operates on the raw body text only.
 * If the adapter does not declare pluginRootSubstitution, the text is returned
 * unchanged (graceful degradation for adapters that pre-date this field).
 */
function applyPluginRootSubstitution(text, adapter) {
  if (!adapter.pluginRootSubstitution) return text;
  return text.replaceAll('${PLUGIN_ROOT}', adapter.pluginRootSubstitution);
}

// ── Claude plugin agent-name namespacing ─────────────────────────────

/**
 * Lists every canonical agent name (filename minus `.md`) under
 * `<canonicalRoot>/agents/`. Returns a sorted, longest-first array so that
 * regex alternation prefers `coder-junior` over `coder` and never produces
 * a doubly-prefixed `rad-orchestration:rad-orchestration:coder` overlap.
 *
 * The orchestrator agent itself is excluded — orchestrator never dispatches
 * to itself, so namespacing its own name in dispatch contexts would be
 * meaningless and risk false positives in self-referential prose.
 */
function listCanonicalAgentNames(canonicalRoot) {
  const agentsDir = path.join(canonicalRoot, 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  const names = fs.readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .filter((n) => n !== 'orchestrator');
  // Longest-first ordering so `coder-junior` is tried before `coder` in the
  // alternation — without this, the bare-name pattern would match `coder` in
  // `coder-junior` and produce `rad-orchestration:coder-junior` only via the
  // longer alternative, but never `rad-orchestration:coder` followed by
  // `-junior`.
  names.sort((a, b) => b.length - a.length || a.localeCompare(b));
  return names;
}

/**
 * Rewrites every recognized agent dispatch token in `text` from its bare
 * canonical form (e.g. `coder`) to its plugin-namespaced form
 * (`rad-orchestration:coder`). Gated on `adapter.name === 'claude'`; other
 * adapters return text unchanged.
 *
 * Conservative scoping — the substitution only fires inside known dispatch
 * contexts, never on every prose mention of an agent name:
 *
 *   1. `**<name>**`              — markdown-bold dispatch tokens
 *      (e.g. `Spawn **coder** agent`, `the **planner** agent`)
 *   2. `<name> agent` / `<name> agents` — bare-name followed by ` agent(s)`
 *      (catches "spawning the planner agent" prose)
 *   3. `<name> spawn` / `<name> spawns` — bare-name followed by ` spawn(s)`
 *      (catches "every planner spawn" — dispatch context)
 *   4. Comma-separated dispatch lists — `<name>, <name>, ..., and <name>
 *      spawns/agents` shape. When the tail of a comma-list closes on
 *      ` spawn(s)` or ` agent(s)`, every agent name in the list head is
 *      a dispatch reference and gets namespaced.
 *   5. `subagent_type: <name>`   — YAML/code dispatch identifiers
 *
 * Names sourced dynamically from `<canonicalRoot>/agents/` (no hardcoded
 * list); `orchestrator` is filtered out by `listCanonicalAgentNames`.
 *
 * Already-namespaced occurrences (`rad-orchestration:<name>`) are preserved
 * — every regex in the chain includes a negative lookbehind / lookahead
 * guard so the function is idempotent against repeat application.
 */
function applyClaudeNamespacing(text, adapter, canonicalAgentNames) {
  if (adapter.name !== 'claude') return text;
  if (!canonicalAgentNames || canonicalAgentNames.length === 0) return text;

  const escaped = canonicalAgentNames.map(escapeRegex);
  const alt = escaped.join('|');
  const ns = 'rad-orchestration:';

  let out = text;

  // 1. **<name>** — markdown-bold dispatch token.
  out = out.replace(
    new RegExp(`\\*\\*(?:rad-orchestration:)?(${alt})\\*\\*`, 'g'),
    `**${ns}$1**`,
  );

  // 4. Comma-separated dispatch lists closed by " spawn(s)" or " agent(s)".
  //    Match `<name>, <name>, ..., (?:and )?<name> (spawns|agents)` and
  //    namespace every entry. Run before rule #2/#3 so list bodies are
  //    handled in one pass before the per-name suffix patterns fire.
  const listEntry = `(?:rad-orchestration:)?(?:${alt})`;
  const listRegex = new RegExp(
    `(?<![\\w:-])(${listEntry}(?:,\\s+(?:and\\s+)?${listEntry})+)(?=\\s+(?:spawns?|agents?)\\b)`,
    'g',
  );
  out = out.replace(listRegex, (match) => {
    return match.replace(
      new RegExp(`(?<![\\w:-])(?:rad-orchestration:)?(${alt})\\b`, 'g'),
      `${ns}$1`,
    );
  });

  // 2. <name> agent(s) — bare-name followed by " agent" or " agents".
  out = out.replace(
    new RegExp(`(?<![\\w:-])(${alt})(?= agents?\\b)`, 'g'),
    `${ns}$1`,
  );

  // 3. <name> spawn(s) — bare-name followed by " spawn" or " spawns".
  out = out.replace(
    new RegExp(`(?<![\\w:-])(${alt})(?= spawns?\\b)`, 'g'),
    `${ns}$1`,
  );

  // 5. subagent_type: <name> — YAML/code dispatch identifier.
  out = out.replace(
    new RegExp(`(subagent_type:\\s*)(?:rad-orchestration:)?(${alt})\\b`, 'g'),
    `$1${ns}$2`,
  );

  return out;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
