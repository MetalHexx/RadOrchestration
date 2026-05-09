import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
export async function git(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return execFileP('git', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
}
