// adapters/_template/adapter.js — Reference shape for new harness adapters.
// Copy this folder to `adapters/<harness-name>/` and fill in every block below.
// Ground every harness specific in `frontmatter-research.md` (cite the section in README.md).

/** @import { Adapter } from '../types.d.ts' */

/** @type {Adapter} */
export const adapter = {
  name: '_template',
  targetDir: '<harness-target-dir>',  // e.g. '.claude' or '.github'

  filenameRule({ kind, canonicalName }) {
    throw new Error('_template: filenameRule not implemented');
  },

  agentFrontmatter(canonical, _ctx) {
    throw new Error('_template: agentFrontmatter not implemented');
  },

  skillFrontmatter(canonical, _ctx) {
    throw new Error('_template: skillFrontmatter not implemented');
  },

  toolDictionary: Object.freeze({
    // Map PascalCase Claude tool names to the harness's vocabulary.
    // Example: Read: 'read', Bash: 'execute', ...
  }),

  modelAliases: Object.freeze({
    haiku: '<harness-haiku-id>',
    sonnet: '<harness-sonnet-id>',
    opus: '<harness-opus-id>',
  }),

  // pluginRootSubstitution — required for every adapter (AD-15).
  // The string that replaces the canonical ${PLUGIN_ROOT} placeholder in skill
  // bodies during emit. Set this to the harness-specific token or path expression
  // that resolves to the installed plugin root at runtime.
  //   • Claude Code: '${CLAUDE_PLUGIN_ROOT}'  (native Claude plugin-root variable)
  //   • Copilot adapters: '{orchRoot}'         (runtime-resolved orch root)
  //   • New harness: replace '<harness-plugin-root>' below with the harness token.
  pluginRootSubstitution: '<harness-plugin-root>',
};
