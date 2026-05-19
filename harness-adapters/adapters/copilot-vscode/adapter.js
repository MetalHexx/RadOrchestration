// GitHub Copilot in VS Code adapter. Per-harness frontmatter is hand-authored
// in lowercase Copilot vocabulary in harness-files/agents/*.copilot-vscode.yml.

export const adapter = {
  name: 'copilot-vscode',
  filenames: {
    agent: '{name}.agent.md',
    skill: 'SKILL.md',
  },
  bodyTokens: {},
};
