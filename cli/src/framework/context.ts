import type { Logger } from './logger/types.js';
import type { Prompter } from './prompter.js';
import type { Theme } from './theme.js';

export interface UxFlags {
  isTTY: boolean;
  nonInteractive: boolean;
  noColor: boolean;
  json: boolean;
}
export interface CommandContext {
  env: NodeJS.ProcessEnv;
  stderr: NodeJS.WriteStream;
  logger: Logger;
  prompter: Prompter;
  theme: Theme;
  ux: UxFlags;
}
