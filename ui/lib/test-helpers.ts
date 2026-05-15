import os from 'node:os';

/**
 * AD-9 — swaps os.homedir for the duration of fn and restores it in a
 * finally block. Use this for every UI test that needs a stubbed homedir;
 * never mutate os.homedir directly without a guaranteed restore.
 */
export async function withHomedir(stub: string, fn: () => Promise<void> | void): Promise<void> {
  const original = (os as unknown as { homedir: () => string }).homedir;
  (os as unknown as { homedir: () => string }).homedir = () => stub;
  try { await fn(); } finally {
    (os as unknown as { homedir: () => string }).homedir = original;
  }
}
