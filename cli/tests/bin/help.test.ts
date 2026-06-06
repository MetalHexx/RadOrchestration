import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
const execP = promisify(execFile);
const repoRoot = path.resolve(__dirname, '..', '..');

describe('radorch program wiring', () => {
  it('exposes doctor and where subcommands in --help', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const { stdout } = await execP('node', ['dist/bin/radorch.js', '--help'], {
      cwd: repoRoot,
      env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    expect(stdout).toMatch(/doctor/);
    expect(stdout).toMatch(/where/);
    expect(stdout).toMatch(/Tip: use 'radorch where <name>'/);
  }, 30_000);

  it('exposes git commit and git pr subcommands at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
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
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
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

  it('exposes worktree create and worktree launch with per-agent matrix in launch help', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bworktree\b/);
    const { stdout: wtHelp } = await node(['worktree', '--help']);
    expect(wtHelp).toMatch(/create\s+Create a worktree/);
    expect(wtHelp).toMatch(/launch\s+Open a terminal/);
    const { stdout: createHelp } = await node(['worktree', 'create', '--help']);
    expect(createHelp).toMatch(/--repo-root/);
    expect(createHelp).toMatch(/--branch/);
    expect(createHelp).toMatch(/--worktree-path/);
    expect(createHelp).toMatch(/--base-branch/);
    const { stdout: launchHelp } = await node(['worktree', 'launch', '--help']);
    expect(launchHelp).toMatch(/--agent/);
    expect(launchHelp).toMatch(/--prompt required for: claude, copilot/);
    expect(launchHelp).toMatch(/--permission-mode only valid with: claude/);
  }, 30_000);

  it('exposes plan explode at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bplan\b/);
    const { stdout: planHelp } = await node(['plan', '--help']);
    expect(planHelp).toMatch(/explode\s+Explode the Master Plan into phase and task files/);
    const { stdout: explodeHelp } = await node(['plan', 'explode', '--help']);
    expect(explodeHelp).toMatch(/--project-dir/);
    expect(explodeHelp).toMatch(/--master-plan/);
    expect(explodeHelp).toMatch(/--project-name/);
  }, 30_000);

  it('exposes skill list at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bskill\b/);
    const { stdout: skillHelp } = await node(['skill', '--help']);
    expect(skillHelp).toMatch(/list[\s\S]+List repository SKILL\.md/);
    const { stdout: listHelp } = await node(['skill', 'list', '--help']);
    expect(listHelp).toMatch(/--repo-root/);
    expect(listHelp).toMatch(/Absolute path to the repository root[\s\S]+scanned/);
  }, 30_000);

  it('exposes repo-group subcommands at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\brepo-group\b/);
    const { stdout: rgHelp } = await node(['repo-group', '--help']);
    expect(rgHelp).toMatch(/create\s+Create a repo-group/);
    expect(rgHelp).toMatch(/add\s+Add a registered repo to a repo-group/);
    expect(rgHelp).toMatch(/remove\s+Remove a repo from a repo-group/);
    expect(rgHelp).toMatch(/delete\s+Delete a repo-group/);
    expect(rgHelp).toMatch(/list\s+List all repo-groups/);
    expect(rgHelp).toMatch(/show\s+Show description and members/);
    expect(rgHelp).toMatch(/edit\s+Edit a repo-group/);
    const { stdout: createHelp } = await node(['repo-group', 'create', '--help']);
    expect(createHelp).toMatch(/--name/);
    expect(createHelp).toMatch(/--members/);
  }, 30_000);

  it('exposes session-context in root help and with description in its own --help', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bsession-context\b/);
    const { stdout: scHelp } = await node(['session-context', '--help']);
    expect(scHelp).toMatch(/Rendered session preamble/);
  }, 30_000);

  it('exposes pipeline signal at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bpipeline\b/);
    const { stdout: pipelineHelp } = await node(['pipeline', '--help']);
    expect(pipelineHelp).toMatch(/signal\s+Signal a pipeline event/);
    const { stdout: signalHelp } = await node(['pipeline', 'signal', '--help']);
    expect(signalHelp).toMatch(/--event/);
    expect(signalHelp).toMatch(/--project-dir/);
    expect(signalHelp).toMatch(/--doc-path/);
    expect(signalHelp).toMatch(/--parse-error/);
    expect(signalHelp).toMatch(/--verdict/);
    expect(signalHelp).toMatch(/--gate-type/);
    expect(signalHelp).toMatch(/--gate-mode/);
  }, 30_000);

  it('exposes side-project init at three help depths', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/side-project/);
    const { stdout: nounHelp } = await node(['side-project', '--help']);
    expect(nounHelp).toMatch(/init\s+Provision a local-only side-project git repo/);
    const { stdout: initHelp } = await node(['side-project', 'init', '--help']);
    expect(initHelp).toMatch(/--project/);
  }, 30_000);

  it('exposes migrate in root help and responds to its own --help with safety-rail flags', async () => {
    await execP('npx', ['tsc'], { cwd: repoRoot, shell: process.platform === 'win32' });
    const node = (args: string[]) => execP('node', ['dist/bin/radorch.js', ...args], {
      cwd: repoRoot, env: { ...process.env, RADORCH_NO_LOG: '1' },
    });
    const { stdout: rootHelp } = await node(['--help']);
    expect(rootHelp).toMatch(/\bmigrate\b/);
    expect(rootHelp).toMatch(/migrate\s+Migrate a project state\.json to the current schema version/);
    const { stdout: migrateHelp } = await node(['migrate', '--help']);
    expect(migrateHelp).toMatch(/--project/);
    expect(migrateHelp).toMatch(/--all/);
    expect(migrateHelp).toMatch(/--dry-run/);
  }, 30_000);
});
