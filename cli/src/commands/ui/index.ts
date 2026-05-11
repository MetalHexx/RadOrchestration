import { defineCommand } from '../../framework/command.js';
import type { CommandContext } from '../../framework/context.js';
import { runStart } from './start.js';
import { runStop } from './stop.js';
import { runStatus } from './status.js';

export const uiStartCommand = defineCommand({
  name: 'ui-start',
  description: 'Spawn the detached UI server and emit the URL',
  args: {},
  flags: {},
  handler: async ({ ctx }: { ctx: CommandContext }) => runStart({ env: ctx.env }),
});

export const uiStopCommand = defineCommand({
  name: 'ui-stop',
  description: 'Stop the detached UI server (SIGTERM) and clear the PID file',
  args: {},
  flags: {},
  handler: async ({ ctx }: { ctx: CommandContext }) => runStop({ env: ctx.env }),
});

export const uiStatusCommand = defineCommand({
  name: 'ui-status',
  description: 'Report whether the detached UI server is running',
  args: {},
  flags: {},
  handler: async () => runStatus(),
});
