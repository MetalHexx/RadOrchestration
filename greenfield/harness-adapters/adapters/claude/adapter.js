// Claude Code adapter. The legacy adapter at /adapters/claude/adapter.js
// carries a tool dictionary, a model alias map, and a frontmatter projector;
// none of that is needed here — Claude per-harness ymls live alongside
// each agent body in greenfield/harness-files/agents/ and are read verbatim.

export const adapter = {
  name: 'claude',
  filenames: {
    agent: '{name}.md',
    skill: 'SKILL.md',
  },
  bodyTokens: {},
};
