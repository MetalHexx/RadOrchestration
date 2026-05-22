import { Command, CommanderError } from 'commander';
import { createPrompter } from './prompter.js';
import { makeTheme } from './theme.js';
import { createFileSink } from './logger/file-sink.js';
import { createLogger, resolveLogLevel } from './logger/logger.js';
import { emit } from './output.js';
import { ExitCode } from './exit-codes.js';
import { RadorchError, SystemError, UserError } from './errors.js';
import { installPaths, resolveInstallRoot } from '../lib/paths.js';
import { checkVersionSkew, stampLastWriter } from '../lib/install-json.js';
import { getCliVersion } from '../lib/package-version.js';
import type { CommandContext, UxFlags } from './context.js';
import { LOG_LEVELS } from './logger/types.js';
import type { LogLevel } from './logger/types.js';

const pkg = { version: getCliVersion() };

export function pickLogLevel(flag: string | undefined, env: NodeJS.ProcessEnv): LogLevel {
  if (flag && (LOG_LEVELS as readonly string[]).includes(flag)) return flag as LogLevel;
  return resolveLogLevel(env);
}

export interface ArgSpec { description: string; required?: boolean; default?: string }
export interface FlagSpec { description: string; default?: boolean | string; type?: 'boolean' | 'string' }
export interface CommandDef<Args, Flags, Result> {
  name: string;
  description: string;
  args: { [K in keyof Args]: ArgSpec };
  flags: { [K in keyof Flags]: FlagSpec };
  handler: (ctx: { args: Args; flags: Flags; ctx: CommandContext }) => Promise<Result>;
  mapResult?: (result: Result) => { ok: boolean; data?: unknown; error?: { type: 'user_error' | 'system_error'; message: string }; warnings?: string[]; exit_code?: number };
}

export function defineCommand<Args, Flags, Result>(def: CommandDef<Args, Flags, Result>): CommandDef<Args, Flags, Result> {
  return def;
}

export interface RunOptions {
  argv: string[];
  env: NodeJS.ProcessEnv;
  isTTY: boolean;
  stderr: NodeJS.WriteStream;
}

export async function runCommand<Args, Flags, Result>(
  def: CommandDef<Args, Flags, Result>,
  opts: RunOptions,
): Promise<void> {
  const cmd = new Command(def.name).description(def.description).exitOverride();
  cmd.option('--non-interactive', 'disable prompts');
  cmd.option('--json', 'force machine-readable output');
  cmd.option('--no-color', 'disable ANSI color');
  cmd.option('--log-level <level>', 'log level (error|warn|info|debug)');
  for (const [name, spec] of Object.entries(def.args) as [string, ArgSpec][]) {
    cmd.option(`--${name} <value>`, spec.description, spec.default);
  }
  for (const [name, spec] of Object.entries(def.flags) as [string, FlagSpec][]) {
    if (spec.type === 'string') cmd.option(`--${name} <value>`, spec.description, spec.default as string | undefined);
    else cmd.option(`--${name}`, spec.description);
  }

  const start = Date.now();
  // NFR-13: color is stripped when any UX gate fires — `NO_COLOR`, `--no-color`, OR non-TTY.
  // Non-TTY counts as a gate so commands piped to logs/CI never leak ANSI escapes.
  const noColorEnv = opts.env['NO_COLOR'] !== undefined && opts.env['NO_COLOR'] !== '';
  const ux: UxFlags = {
    isTTY: opts.isTTY,
    nonInteractive: false,
    noColor: noColorEnv || !opts.isTTY,
    json: false,
  };
  const installRoot = resolveInstallRoot();
  const paths = installPaths(installRoot);

  if (def.name !== 'install') {
    const skew = await checkVersionSkew({ installJsonPath: paths.installJson, localVersion: pkg.version });
    if (!skew.ok) {
      emit({ ok: false, error: { type: 'user_error', message: skew.message } });
      process.exit(ExitCode.UserError);
      return;
    }
  }

  const sink = createFileSink({
    file: paths.cliLog,
    maxBytes: 10 * 1024 * 1024,
    maxFiles: 5,
    env: opts.env,
    requireDirExists: true,
  });
  let logger = createLogger({ level: resolveLogLevel(opts.env), sink, source: 'cli' });

  try {
    cmd.parse(opts.argv, { from: 'user' });
    const parsed = cmd.opts();
    ux.nonInteractive = Boolean(parsed['nonInteractive']);
    ux.json = Boolean(parsed['json']);
    ux.noColor = ux.noColor || parsed['color'] === false;
    logger = createLogger({ level: pickLogLevel(parsed['logLevel'] as string | undefined, opts.env), sink, source: 'cli' });

    // Single-arg wizard for missing required args
    const argsResult = {} as Record<string, unknown>;
    const allowedToPrompt = ux.isTTY && !ux.nonInteractive && !ux.json;
    const prompter = createPrompter({ isTTY: ux.isTTY, nonInteractive: ux.nonInteractive || ux.json });
    for (const [name, spec] of Object.entries(def.args) as [string, ArgSpec][]) {
      // Commander converts --kebab-case to camelCase in opts(); map back so handlers
      // can look up args by their declared hyphenated name (e.g. 'worktree-path').
      const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      let value = (parsed[camel] ?? parsed[name]) as string | undefined;
      if (value === undefined && spec.required) {
        if (allowedToPrompt) {
          value = await prompter.input({ message: `${name}: ${spec.description}`, default: spec.default });
        } else {
          throw new UserError(`Missing required argument --${name} (${spec.description}). Supply --${name}=<value> or run interactively.`);
        }
      }
      argsResult[name] = value ?? spec.default;
    }
    const flagsResult = {} as Record<string, unknown>;
    for (const name of Object.keys(def.flags)) {
      // Commander converts --kebab-case to camelCase in opts(); map back so handlers
      // can look up flags by their declared hyphenated name (e.g. 'default-harness').
      const camel = name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      flagsResult[name] = parsed[camel] ?? parsed[name];
    }

    const ctx: CommandContext = {
      env: opts.env,
      stderr: opts.stderr,
      logger,
      prompter,
      theme: makeTheme({ noColor: ux.noColor }),
      ux,
    };
    const result = await def.handler({ args: argsResult as Args, flags: flagsResult as Flags, ctx });
    const envelope = def.mapResult ? def.mapResult(result) : { ok: true, data: result };
    await logger.info('command_complete', {
      command: def.name,
      args: argsResult,
      duration_ms: Date.now() - start,
      result: envelope.ok ? 'ok' : 'fail',
    });
    await logger.flush();
    emit(envelope as never);
    const overrideExit = envelope.ok && typeof envelope.exit_code === 'number' ? envelope.exit_code : undefined;
    const exitCode = overrideExit !== undefined
      ? overrideExit
      : (envelope.ok ? ExitCode.Success : (envelope.error?.type === 'user_error' ? ExitCode.UserError : ExitCode.SystemError));
    if (envelope.ok && def.name !== 'install') {
      try { await stampLastWriter(paths.installJson, pkg.version); } catch { /* best effort */ }
    }
    process.exit(exitCode);
  } catch (e) {
    // FR-5: parse/usage failures (unknown option, missing value, etc.) are user errors → exit 1.
    // Help/version go through Commander's exitOverride too — Commander has already written their
    // output, so we exit 0 silently without emitting an envelope.
    if (e instanceof CommanderError) {
      if (e.code === 'commander.helpDisplayed' || e.code === 'commander.help' || e.code === 'commander.version') {
        await logger.flush();
        process.exit(0);
        return;
      }
      const userErr = new UserError(e.message);
      await logger.error('command_failed', {
        command: def.name,
        duration_ms: Date.now() - start,
        error: { type: userErr.type, message: userErr.message },
      });
      await logger.flush();
      emit({ ok: false, error: { type: userErr.type, message: userErr.message } });
      process.exit(ExitCode.UserError);
      return;
    }
    const err = e instanceof RadorchError ? e : new SystemError(e instanceof Error ? e.message : String(e));
    await logger.error('command_failed', {
      command: def.name,
      duration_ms: Date.now() - start,
      error: { type: err.type, message: err.message },
    });
    await logger.flush();
    emit({ ok: false, error: { type: err.type, message: err.message } });
    process.exit(err.type === 'user_error' ? ExitCode.UserError : ExitCode.SystemError);
  }
}
