import ora, { type Ora } from 'ora';
export interface SpinnerOptions {
  isTTY: boolean;
  nonInteractive: boolean;
  noColor: boolean;
  json: boolean;
}
export function startSpinner(text: string, opts: SpinnerOptions): { succeed: (msg?: string) => void; fail: (msg?: string) => void } {
  if (!opts.isTTY || opts.nonInteractive || opts.json || opts.noColor) {
    return { succeed: () => {}, fail: () => {} };
  }
  const inst: Ora = ora({ text, stream: process.stderr, color: 'green' }).start();
  return { succeed: (m) => inst.succeed(m), fail: (m) => inst.fail(m) };
}
