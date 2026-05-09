import { Chalk } from 'chalk';
export interface Theme {
  banner: (s: string) => string;
  heading: (s: string) => string;
  success: (s: string) => string;
  warning: (s: string) => string;
  error: (s: string) => string;
  hint: (s: string) => string;
}
const identity = (s: string): string => s;
export function makeTheme(opts: { noColor: boolean }): Theme {
  if (opts.noColor) {
    return { banner: identity, heading: identity, success: identity, warning: identity, error: identity, hint: identity };
  }
  const chalk = new Chalk({ level: 3 });
  return {
    banner: (s) => chalk.greenBright.bold(s),
    heading: (s) => chalk.greenBright.bold(s),
    success: (s) => chalk.greenBright(s),
    warning: (s) => chalk.yellowBright(s),
    error: (s) => chalk.red(s),
    hint: (s) => chalk.dim(s),
  };
}
