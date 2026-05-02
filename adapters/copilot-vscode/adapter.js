// adapters/copilot-vscode/adapter.js — GitHub Copilot in VS Code adapter.
// Sources: frontmatter-research.md §2 (agent + skill format), §5 (matrix),
// §6.6 (model aliases), §6.2 (allowed-tools pass-through note).

/** @import { Adapter } from '../types.d.ts' */

// Canonical Claude PascalCase tool names → lowercase Copilot aliases (research §2.A, §5.5).
const TOOL_DICTIONARY = Object.freeze({
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'execute',
  Grep: 'search',
  Glob: 'search',
  TodoWrite: 'todo',
  WebFetch: 'web/fetch',
  WebSearch: 'web',
  Task: 'agent',
  Agent: 'agent',
});

// (copilot)-suffixed display names per research §6.6 — VS Code resolver
// tries the verbatim string first, strips trailing "(...)" on fallback.
// Suffix is tolerated and unambiguously identifies the Copilot-hosted variant.
const MODEL_ALIASES = Object.freeze({
  haiku: 'Claude Haiku 4.5 (copilot)',
  sonnet: 'Claude Sonnet 4.6 (copilot)',
  opus: 'Claude Opus 4.7 (copilot)',
});

/** @type {Adapter} */
export const adapter = {
  name: 'copilot-vscode',
  targetDir: '.github',

  filenameRule({ kind, canonicalName }) {
    return kind === 'agent' ? `${canonicalName}.agent.md` : 'SKILL.md';
  },

  // Stubbed — P04-T02 fills in frontmatter projection.
  agentFrontmatter(canonical) {
    return { ...canonical };
  },
  skillFrontmatter(canonical) {
    return { ...canonical };
  },

  toolDictionary: TOOL_DICTIONARY,
  modelAliases: MODEL_ALIASES,
};
