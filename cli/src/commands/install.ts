import { createRequire } from 'node:module';
import { pathExists } from '../lib/fs-helpers.js';
import { resolveInstallRoot } from '../lib/paths.js';
import { UserError } from '../framework/errors.js';
import { defineCommand } from '../framework/command.js';
import type { CommandContext } from '../framework/context.js';
import { isHarnessName, HarnessName } from '../framework/harness.js';
import { writeInstallSkeleton } from './install/skeleton.js';
import { writeHarnessBundles } from './install/harness-bundles.js';
import { startSpinner } from '../framework/spinner.js';
import { renderBanner } from '../framework/banner.js';

const require_ = createRequire(import.meta.url);
const pkg = require_('../../package.json') as { version: string };

export interface InstallResult {
  root: string;
  version: string;
  harnesses_installed: typeof HarnessName;
  active_harness: HarnessName;
}

export async function runInstall(opts: {
  defaultHarness: HarnessName;
  ctx: { env: NodeJS.ProcessEnv; ux: { isTTY: boolean; nonInteractive: boolean; noColor: boolean; json: boolean }; stderr: NodeJS.WriteStream };
}): Promise<InstallResult> {
  const root = resolveInstallRoot(opts.ctx.env);
  if (await pathExists(root)) {
    throw new UserError(`radorch install root already exists at ${root}. Remove it before re-running install.`);
  }
  // Banner + next-steps hint render only in true interactive mode (DD-1, DD-9). When ux.isTTY=false they no-op.
  renderBanner({ stream: opts.ctx.stderr, isTTY: opts.ctx.ux.isTTY, nonInteractive: opts.ctx.ux.nonInteractive, noColor: opts.ctx.ux.noColor, json: opts.ctx.ux.json });
  const sp1 = startSpinner('Writing install skeleton', opts.ctx.ux);
  await writeInstallSkeleton({ root, packageVersion: pkg['version'], defaultHarness: opts.defaultHarness });
  sp1.succeed('Install skeleton written');
  const sp2 = startSpinner('Installing harness bundles', opts.ctx.ux);
  await writeHarnessBundles(root);
  sp2.succeed('Harness bundles installed');

  if (opts.ctx.ux.isTTY && !opts.ctx.ux.nonInteractive && !opts.ctx.ux.json) {
    opts.ctx.stderr.write(`\nNext steps:\n  - radorch repo add (lands in #1.1)\n  - radorch doctor\n`);
  }

  return {
    root,
    version: pkg['version'],
    harnesses_installed: HarnessName,
    active_harness: opts.defaultHarness,
  };
}

export const installCommand = defineCommand({
  name: 'install',
  description: 'Install the global radorch system on this developer machine',
  args: {},
  flags: {
    y: { description: 'accept the claude default and skip the prompt' },
    'default-harness': { description: 'active harness (claude | copilot-vscode | copilot-cli)', type: 'string' as const },
  },
  handler: async ({ flags, ctx }: { flags: { y?: boolean; 'default-harness'?: string }; ctx: CommandContext }) => {
    let defaultHarness: HarnessName = 'claude';
    const flagged = flags['default-harness'];
    if (flagged) {
      if (!isHarnessName(flagged)) throw new UserError(`Unknown harness "${flagged}". Expected one of: ${HarnessName.join(', ')}.`);
      defaultHarness = flagged;
    } else if (ctx.ux.isTTY && !ctx.ux.nonInteractive && !flags.y) {
      const picked = await ctx.prompter.select({ message: 'Default active harness', choices: HarnessName, default: 'claude' });
      defaultHarness = picked;
    } else if (!ctx.ux.isTTY && !flags.y) {
      throw new UserError('Non-TTY install requires --default-harness=<h> or --y (accepts claude).');
    }
    return runInstall({ defaultHarness, ctx });
  },
});
