import { defineCommand } from '../../framework/command.js';
import { userDataPaths } from '../../lib/paths.js';
import { renderPreamble } from './render.js';

export interface SessionContextResult { preamble: string }

export const sessionContextCommand = defineCommand({
  name: 'session-context',
  description: 'Rendered session preamble for orchestrator session initialization',
  args: {},
  flags: {},
  handler: async (): Promise<SessionContextResult> => {
    return { preamble: renderPreamble({ root: userDataPaths().root }) };
  },
});
