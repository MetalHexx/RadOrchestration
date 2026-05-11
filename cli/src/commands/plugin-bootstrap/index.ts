import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import { isHarnessName } from '../../framework/harness.js';
import type { CommandContext } from '../../framework/context.js';
import { runPluginBootstrap } from './run.js';

interface PluginBootstrapFlags {
  force?: boolean;
  quiet?: boolean;
  harness?: string;
  'plugin-root'?: string;
}

export const pluginBootstrapCommand = defineCommand({
  name: 'plugin-bootstrap',
  description: 'Bootstrap or upgrade the global radorch install from a plugin payload',
  args: {},
  flags: {
    force: { description: 're-install even when versions match' },
    quiet: { description: 'suppress non-error output (hook context)' },
    harness: { description: 'target harness (claude | copilot-vscode | copilot-cli)', type: 'string' as const },
    'plugin-root': { description: 'absolute path to the plugin payload', type: 'string' as const },
  },
  handler: async ({ flags, ctx }: { args: object; flags: PluginBootstrapFlags; ctx: CommandContext }) => {
    if (!flags.harness || !isHarnessName(flags.harness)) throw new UserError('--harness required (claude | copilot-vscode | copilot-cli)');
    if (!flags['plugin-root']) throw new UserError('--plugin-root required');
    const result = await runPluginBootstrap({
      pluginRoot: flags['plugin-root'],
      harness: flags.harness,
      force: Boolean(flags.force),
      quiet: Boolean(flags.quiet),
    });
    // Stderr: human-readable warning for downgrade-noop (DD-5).
    // The message from run.ts already includes the doctor hint — do not repeat it.
    if (result.action === 'downgrade-noop' && result.message && !flags.quiet) {
      ctx.stderr.write(result.message + '\n');
    }
    return result;
  },
});
