// adapters/copilot-cli/adapter.js — GitHub Copilot CLI adapter.
// Sources: frontmatter-research.md §3 (agent + skill format), §5 (matrix),
// §6.6 (CLI model aliases — copilot-cli #2904, #2785).

/** @import { Adapter } from '../types.d.ts' */

// Canonical Claude PascalCase tool names → lowercase CLI aliases (research §3.A, §5.5).
const TOOL_DICTIONARY = Object.freeze({
  Read: 'read',
  Write: 'edit',
  Edit: 'edit',
  Bash: 'execute',
  Grep: 'search',
  Glob: 'search',
  TodoWrite: 'todo',
  WebFetch: 'web',
  WebSearch: 'web',
  Task: 'agent',
  Agent: 'agent',
});

// Dot-versioned hyphenated ids per research §6.6 — CLI rejects display-name
// form with the warning: "<name> is not available; will use current model
// instead" (copilot-cli #1752, #2099, #2133).
const MODEL_ALIASES = Object.freeze({
  haiku: 'claude-haiku-4.5',
  sonnet: 'claude-sonnet-4.6',
  opus: 'claude-opus-4.7',
});

/** @type {Adapter} */
export const adapter = {
  name: 'copilot-cli',
  targetDir: '.github',

  filenameRule({ kind, canonicalName }) {
    return kind === 'agent' ? `${canonicalName}.agent.md` : 'SKILL.md';
  },

  // Stubbed — P05-T02 fills in frontmatter projection.
  agentFrontmatter(canonical) {
    return { ...canonical };
  },
  skillFrontmatter(canonical) {
    return { ...canonical };
  },

  toolDictionary: TOOL_DICTIONARY,
  modelAliases: MODEL_ALIASES,
};
