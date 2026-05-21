import { Command } from 'commander';
import { runCommand } from './framework/command.js';
import { doctorCommand } from './commands/doctor/index.js';
import { uiStartCommand, uiStopCommand, uiStatusCommand } from './commands/ui/index.js';
import { gitCommitCommand, gitPrCommand } from './commands/git/index.js';
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

  program.addHelpText(
    'after',
    "\nTip: use 'radorch where <name>' to resolve any radorch path (projects, registry, config, ...). 'radorch where' with no arg lists them all.",
  );

  return program;
}
