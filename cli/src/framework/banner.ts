import figlet from 'figlet';
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
  const cols = opts.stream.columns ?? 80;
  if (cols < 60) {
    opts.stream.write('\n' + theme.banner('RadOrch') + '\n\n');
    return;
  }
  const text = figlet.textSync('RadOrch', { font: 'Bloody' });
  const lines = text.split('\n').map((line) => theme.banner(line)).join('\n');
  opts.stream.write('\n' + lines + '\n\n');
}
