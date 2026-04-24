import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface InvokeLaunchClaudeProjectArgs {
  /** Absolute path to the workspace root; becomes the launched terminal's cwd. */
  workspaceRoot: string;
  /** Slash-prefixed prompt string (e.g. `/brainstorm FOO`). */
  prompt: string;
  /** Optional Claude Code permission mode; defaults to `auto` in the script. */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'auto' | 'dontAsk' | 'plan';
}

export interface LauncherResult {
  success: boolean;
  platform?: NodeJS.Platform;
  permissionMode?: string;
  error?: string;
}

/**
 * Invoke the co-located launch-claude-project.js script and parse its
 * single-line JSON stdout contract. Never throws — always returns a
 * structured { success, ... } object. (NFR-2)
 */
export async function invokeLaunchClaudeProject(
  args: InvokeLaunchClaudeProjectArgs
): Promise<LauncherResult> {
  const scriptPath = path.resolve(process.cwd(), 'lib', 'launch-claude-project.js');

  const cliArgs: string[] = [
    scriptPath,
    '--workspace-root', args.workspaceRoot,
    '--prompt', args.prompt,
  ];
  if (args.permissionMode) {
    cliArgs.push('--permission-mode', args.permissionMode);
  }

  try {
    const { stdout } = await execFileAsync(process.execPath, cliArgs, { encoding: 'utf-8' });
    const trimmed = stdout.trim();
    if (!trimmed) {
      return { success: false, error: 'Launcher produced no output.' };
    }
    return JSON.parse(trimmed) as LauncherResult;
  } catch (err: unknown) {
    const execErr = err as { stdout?: string; stderr?: string; message?: string };
    if (execErr.stdout) {
      try {
        return JSON.parse(execErr.stdout.trim()) as LauncherResult;
      } catch {
        // fall through to generic error
      }
    }
    return { success: false, error: execErr.message || 'Launcher invocation failed.' };
  }
}
