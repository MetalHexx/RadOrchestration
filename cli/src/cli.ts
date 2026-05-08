import { Command } from 'commander';
import { runCommand } from './framework/command.js';
import { installCommand } from './commands/install.js';
import { doctorCommand } from './commands/doctor/index.js';
import { harnessUseCommand } from './commands/harness-use.js';
import { harnessListCommand } from './commands/harness-list.js';

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

  return program;
}
