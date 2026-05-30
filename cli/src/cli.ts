import { Command } from 'commander';
import { runCommand } from './framework/command.js';
import { doctorCommand } from './commands/doctor/index.js';
import { uiStartCommand, uiStopCommand, uiStatusCommand } from './commands/ui/index.js';
import { gitCommitCommand, gitPrCommand } from './commands/git/index.js';
import { repoAddCommand, repoBindCommand } from './commands/repo/index.js';
import { projectContextCommand, projectFindCommand } from './commands/project/index.js';
import { worktreeCreateCommand, worktreeLaunchCommand } from './commands/worktree/index.js';
import { planExplodeCommand } from './commands/plan/index.js';
import { skillListCommand } from './commands/skill/index.js';
import { pipelineSignalCommand } from './commands/pipeline/index.js';
import { runWhere, whereHelpText, WHERE_DESCRIPTION } from './commands/where.js';

export function buildProgram(version: string): Command {
  const program = new Command('radorch');
  program.description('radorch CLI — global orchestration root manager').version(version);

  program
    .command('doctor')
    .description(doctorCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(3);
      await runCommand(doctorCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  program
    .command('where [name]')
    .description(WHERE_DESCRIPTION)
    .addHelpText('after', '\n' + whereHelpText())
    .action(async (name?: string) => {
      const code = await runWhere({ name, stdout: process.stdout, stderr: process.stderr, env: process.env });
      process.exit(code);
    });

  const ui = program.command('ui').description('UI server lifecycle');
  ui
    .command('start')
    .description(uiStartCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(uiStartCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  ui
    .command('stop')
    .description(uiStopCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(uiStopCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  ui
    .command('status')
    .description(uiStatusCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(uiStatusCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const git = program.command('git').description('Source control operations');
  git
    .command('commit')
    .description(gitCommitCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(gitCommitCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  git
    .command('pr')
    .description(gitPrCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(gitPrCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const repo = program.command('repo').description('Repo registry operations');
  repo
    .command('add')
    .description(repoAddCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(repoAddCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  repo
    .command('bind')
    .description(repoBindCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(repoBindCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const project = program.command('project').description('Project state read operations');
  project
    .command('context')
    .description(projectContextCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(projectContextCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  project
    .command('find')
    .description(projectFindCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(projectFindCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const worktree = program.command('worktree').description('Worktree lifecycle operations');
  worktree
    .command('create')
    .description(worktreeCreateCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(worktreeCreateCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  worktree
    .command('launch')
    .description(worktreeLaunchCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(worktreeLaunchCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const plan = program.command('plan').description('Master Plan operations');
  plan
    .command('explode')
    .description(planExplodeCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(planExplodeCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const skill = program.command('skill').description('Repository skill catalog operations');
  skill
    .command('list')
    .description(skillListCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(skillListCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  const pipeline = program.command('pipeline').description('Pipeline event dispatch');
  pipeline
    .command('signal')
    .description(pipelineSignalCommand.description)
    .helpOption(false)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(pipelineSignalCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  // Gate subcommands lazy-load their modules so the pipeline-lib import chain
  // (incl. ajv) only fires when a gate command actually runs. Top-level eager
  // imports would force every cli invocation — even `--version` — to load the
  // pipeline runtime and its CJS deps.
  const gate = program.command('gate').description('pipeline gate operations');
  const gateApprove = gate.command('approve').description('approve a pipeline gate');
  gateApprove
    .command('plan')
    .description('Approve the project Master Plan')
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const { approvePlanCommand } = await import('./commands/gate/approve-plan.js');
      const argv = process.argv.slice(5);
      await runCommand(approvePlanCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  gateApprove
    .command('final')
    .description('Approve the project Final Review')
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const { approveFinalCommand } = await import('./commands/gate/approve-final.js');
      const argv = process.argv.slice(5);
      await runCommand(approveFinalCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  // Action-events `compose` lazy-loads so the pipeline-engine import chain
  // (parseActionEventFile, composer, etc.) only fires when this subcommand
  // actually runs. The catalog/shipped/custom UI surfaces are served in-process
  // by the dashboard's API routes and do not need CLI subcommands of their own.
  const actionEvents = program.command('action-events').description('Action/event catalog operations');
  actionEvents
    .command('compose')
    .description('Compose an action or orphan-event prompt (reads optional {overlay} from stdin)')
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const { composeCommand } = await import('./commands/action-events/compose.js');
      const argv = process.argv.slice(4);
      await runCommand(composeCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  program.addHelpText(
    'after',
    "\nTip: use 'radorch where <name>' to resolve any radorch path (projects, registry, config, ...). 'radorch where' with no arg lists them all.",
  );

  return program;
}
