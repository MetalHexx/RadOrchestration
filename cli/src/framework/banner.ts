import { makeTheme } from './theme.js';
export interface BannerOptions {
  stream: NodeJS.WriteStream;
  isTTY: boolean;
  nonInteractive: boolean;
  noColor: boolean;
  json: boolean;
}
export function renderBanner(opts: BannerOptions): void {
  if (!opts.isTTY || opts.nonInteractive || opts.json || opts.noColor) return;
  const theme = makeTheme({ noColor: opts.noColor });
  opts.stream.write('\n' + theme.banner('RadOrch') + '\n\n');
}
