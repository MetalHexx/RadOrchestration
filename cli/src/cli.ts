import { Command } from 'commander';
// Command registrations land here in P03 (install, doctor, harness use, harness list).
// Iteration-foundation phase ends with an empty top-level program that supports --help and --version.
export function buildProgram(version: string): Command {
  const program = new Command('radorch');
  program.description('radorch CLI — global orchestration root manager').version(version);
  return program;
}
