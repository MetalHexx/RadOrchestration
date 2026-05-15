import { Command } from 'commander';
import { runCommand } from './framework/command.js';
import { installCommand } from './commands/install.js';
import { doctorCommand } from './commands/doctor/index.js';
import { harnessUseCommand } from './commands/harness-use.js';
import { harnessListCommand } from './commands/harness-list.js';
import { uiStartCommand, uiStopCommand, uiStatusCommand } from './commands/ui/index.js';
import { pluginBootstrapCommand } from './commands/plugin-bootstrap/index.js';
import { runWhere, whereHelpText, WHERE_DESCRIPTION } from './commands/where.js';

export function buildProgram(version: string): Command {
  const program = new Command('radorch');
  program.description('radorch CLI — global orchestration root manager').version(version);

  program
    .command('install')
    .description(installCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(3);
      await runCommand(installCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

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

  const harness = program.command('harness').description('harness operations');
  harness
    .command('use <harness>')
    .description(harnessUseCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async (harnessName: string) => {
      const argv = ['--harness', harnessName, ...process.argv.slice(5)];
      await runCommand(harnessUseCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });
  harness
    .command('list')
    .description(harnessListCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(4);
      await runCommand(harnessListCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
    });

  program
    .command('plugin-bootstrap')
    .description(pluginBootstrapCommand.description)
    .allowUnknownOption()
    .allowExcessArguments(true)
    .action(async () => {
      const argv = process.argv.slice(3);
      await runCommand(pluginBootstrapCommand, { argv, env: process.env, isTTY: Boolean(process.stdin.isTTY), stderr: process.stderr });
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
