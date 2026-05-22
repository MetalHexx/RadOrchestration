import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');

describe('radorch program wiring', () => {
  it('exposes doctor and where subcommands in --help', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const { stdout } = await execP('node', ['dist/cli/src/bin/radorch.js', '--help'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    expect(stdout).toMatch(/doctor/);
    expect(stdout).toMatch(/where/);
    expect(stdout).toMatch(/Tip: use 'radorch where <name>'/);
  }, 30_000);

  it('exposes git commit and git pr subcommands at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/cli/src/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bgit\b/);
    const { stdout: gitHelp } = await node(['git', '--help']);
    expect(gitHelp).toMatch(/commit\s+Commit changes in the worktree and push to origin/);
    expect(gitHelp).toMatch(/pr\s+Open a GitHub pull request for the worktree branch/);
    const { stdout: commitHelp } = await node(['git', 'commit', '--help']);
    expect(commitHelp).toMatch(/--worktree-path/);
    expect(commitHelp).toMatch(/--message/);
    const { stdout: prHelp } = await node(['git', 'pr', '--help']);
    expect(prHelp).toMatch(/--body-file/);
    expect(prHelp).toMatch(/Optional absolute path to a markdown file/);
  }, 30_000);

  it('exposes project context and project find subcommands at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/cli/src/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bproject\b/);
    const { stdout: projectHelp } = await node(['project', '--help']);
    expect(projectHelp).toMatch(/context\s+Return the shared context block/);
    expect(projectHelp).toMatch(/find\s+Find execution-tier projects/);
    const { stdout: contextHelp } = await node(['project', 'context', '--help']);
    expect(contextHelp).toMatch(/--project-name/);
    expect(contextHelp).toMatch(/result includes the project-state block/);
    const { stdout: findHelp } = await node(['project', 'find', '--help']);
    expect(findHelp).toMatch(/--projects-base-path/);
    expect(findHelp).toMatch(/--repo-root/);
    expect(findHelp).toMatch(/--project-name/);
  }, 30_000);
});
