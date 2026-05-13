// adapters/claude/adapter.js — Claude Code adapter (identity transform).
// Canonical IS Claude shape. See frontmatter-research.md §1 (agents + skills),
// §5.2 (cross-harness comparison row), §6.6 (Claude tier aliases).

/** @import { Adapter } from '../types.d.ts' */

/** @type {Adapter} */
export const adapter = {
  name: 'claude',
  targetDir: '.claude',

  filenameRule({ kind, canonicalName }) {
    return kind === 'agent' ? `${canonicalName}.md` : 'SKILL.md';
  },

  // Identity projection — preserves every canonical field including the
  // rad-* prefix on skill names and the Claude tools/model strings.
  agentFrontmatter(canonical) {
    return { ...canonical };
  },

  skillFrontmatter(canonical) {
    return { ...canonical };
  },

  // Claude → Claude: each PascalCase tool name maps to itself.
  toolDictionary: Object.freeze({
    Read: 'Read',
    Write: 'Write',
    Edit: 'Edit',
    Bash: 'Bash',
    Grep: 'Grep',
    Glob: 'Glob',
    TodoWrite: 'TodoWrite',
    WebFetch: 'WebFetch',
    WebSearch: 'WebSearch',
    Task: 'Task',
    Agent: 'Agent',
  }),

  // Claude tier aliases per frontmatter-research.md §1.A and §6.6 (Claude column).
  modelAliases: Object.freeze({
    haiku: 'haiku',
    sonnet: 'sonnet',
    opus: 'opus',
  }),

  // Harness install root used by legacy (non-plugin) emit. The CLI now ships
  // inside the rad-orchestration skill, and skills/ entries route to
  // harnessRoot() — so `${PLUGIN_ROOT}` substitutes to the harness root
  // (`~/.claude`), not the data root (`~/.radorch`). The plugin-specific
  // ${CLAUDE_PLUGIN_ROOT} token is injected by adapters/run-plugin.js
  // directly — not via this adapter field.
  pluginRootSubstitution: '~/.claude',
};
