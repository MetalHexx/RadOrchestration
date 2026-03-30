const fs = require('fs');
const f = '.github/skills/orchestration/references/action-event-reference.md';
let content = fs.readFileSync(f, 'utf8');
// Find the corrupted source_control_init line and replace it entirely
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('source_control_init') && lines[i].includes('--branch')) {
    const bt = '`';
    const correct = '| ' + bt + 'source_control_init' + bt + ' | ' + bt +
      '--branch <name> --base-branch <name> --worktree-path <path> ' +
      '--auto-commit <always\\|never> --auto-pr <always\\|never> ' +
      '--remote-url <url> --compare-url <url>' + bt +
      ' | After ' + bt + 'rad-execute-parallel' + bt +
      ' creates the worktree. One-time initialization that persists source control context to ' +
      bt + 'pipeline.source_control' + bt + ' in state. |';
    lines[i] = correct;
    console.log('Fixed line ' + (i+1));
    break;
  }
}
fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('saved');