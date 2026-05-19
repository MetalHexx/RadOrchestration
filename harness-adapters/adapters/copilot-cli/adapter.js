// GitHub Copilot CLI adapter. Per-harness frontmatter is hand-authored
// in lowercase Copilot vocabulary with CLI-specific model id form in
// greenfield/harness-files/agents/*.copilot-cli.yml.

export const adapter = {
  name: 'copilot-cli',
  filenames: {
    agent: '{name}.agent.md',
    skill: 'SKILL.md',
  },
  bodyTokens: {},
};
