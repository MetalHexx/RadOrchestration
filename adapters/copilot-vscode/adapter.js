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

  agentFrontmatter(canonical) {
    const out = { ...canonical };

    // Tools: PascalCase comma-string OR list → lowercase alias list.
    if (out.tools !== undefined) {
      const items = Array.isArray(out.tools)
        ? out.tools
        : String(out.tools).split(',').map((t) => t.trim()).filter(Boolean);
      out.tools = items.map((t) => TOOL_DICTIONARY[t] ?? t.toLowerCase());
    }

    // Drop Claude-only duplicate allowedTools key (research §1.A — orchestrator.md uses both;
    // VS Code only honors `tools:`).
    delete out.allowedTools;

    // Model: tier alias → (copilot)-suffixed display name; full ids pass through.
    if (out.model !== undefined && MODEL_ALIASES[out.model]) {
      out.model = MODEL_ALIASES[out.model];
    }

    // Target: mark for VS Code (research §2.A — `target: vscode | github-copilot`).
    if (out.target === undefined) out.target = 'vscode';

    return out;
  },

  skillFrontmatter(canonical) {
    // Pass-through: rad-* names preserved; allowed-tools emitted for
    // cross-harness portability even though VS Code silently ignores it
    // (research §6.2 — confirmed via promptFileParser.ts).
    return { ...canonical };
  },

  toolDictionary: TOOL_DICTIONARY,
  modelAliases: MODEL_ALIASES,
};
