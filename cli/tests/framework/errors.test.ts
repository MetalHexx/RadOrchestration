import { describe, expect, it } from 'vitest';
import { RadorchError, UserError, SystemError } from '../../src/framework/errors.js';
import { ExitCode } from '../../src/framework/exit-codes.js';
import { HarnessName, isHarnessName } from '../../src/framework/harness.js';

describe('errors', () => {
  it('UserError carries discriminated type and inherits Error', () => {
    const e = new UserError('bad arg');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(RadorchError);
    expect(e.type).toBe('user_error');
    expect(e.message).toBe('bad arg');
  });

  it('SystemError carries discriminated type and inherits Error', () => {
    const e = new SystemError('disk gone');
    expect(e).toBeInstanceOf(RadorchError);
    expect(e.type).toBe('system_error');
  });
});

describe('exit codes', () => {
  it('exposes 0/1/2 as a closed enum', () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.UserError).toBe(1);
    expect(ExitCode.SystemError).toBe(2);
  });
});

describe('harness enum', () => {
  it('accepts the three known names', () => {
    expect(isHarnessName('claude')).toBe(true);
    expect(isHarnessName('copilot-vscode')).toBe(true);
    expect(isHarnessName('copilot-cli')).toBe(true);
  });
  it('rejects unknown names', () => {
    expect(isHarnessName('cursor')).toBe(false);
    expect(isHarnessName('')).toBe(false);
  });
  it('HarnessName tuple has exactly three entries in fixed order', () => {
    expect(HarnessName).toEqual(['claude', 'copilot-vscode', 'copilot-cli']);
  });
});
