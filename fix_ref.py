f = r'.github\skills\orchestration\references\action-event-reference.md'
lines = open(f, encoding='utf-8').readlines()
correct_parts = [
    '| source_control_init | ',
    '--branch <name> --base-branch <name> --worktree-path <path> ',
    '--auto-commit <always\|never> --auto-pr <always\|never> ',
    '--remote-url <url> --compare-url <url>',
    ' | After ad-execute-parallel creates the worktree. ',
    'One-time initialization that persists source control context to pipeline.source_control in state. |\n'
]
correct = ''.join(correct_parts)
for i, line in enumerate(lines):
    if 'source_control_init' in line and 'branch' in line:
        lines[i] = correct
        print('Fixed line', i+1)
        break
open(f, 'w', encoding='utf-8').writelines(lines)
print('saved')
