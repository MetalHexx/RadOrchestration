import { describe, expect, it } from 'vitest';
import { startSpinner } from '../../src/framework/spinner.js';

describe('startSpinner', () => {
  it('returns no-op handles when isTTY is false', () => {
    const sp = startSpinner('working', { isTTY: false, nonInteractive: false, noColor: false, json: false });
    expect(typeof sp.succeed).toBe('function');
    expect(typeof sp.fail).toBe('function');
    expect(() => sp.succeed('done')).not.toThrow();
    expect(() => sp.fail('oops')).not.toThrow();
  });

  it('returns no-op handles when nonInteractive is true', () => {
    const sp = startSpinner('working', { isTTY: true, nonInteractive: true, noColor: false, json: false });
    expect(() => sp.succeed()).not.toThrow();
    expect(() => sp.fail()).not.toThrow();
  });

  it('returns no-op handles when noColor is true', () => {
    const sp = startSpinner('working', { isTTY: true, nonInteractive: false, noColor: true, json: false });
    expect(() => sp.succeed()).not.toThrow();
    expect(() => sp.fail()).not.toThrow();
  });

  it('returns no-op handles when json is true', () => {
    const sp = startSpinner('working', { isTTY: true, nonInteractive: false, noColor: false, json: true });
    expect(() => sp.succeed()).not.toThrow();
    expect(() => sp.fail()).not.toThrow();
  });
});
