import { describe, expect, it } from 'vitest';
import { UserError } from '../../src/framework/errors.js';
import { createPrompter } from '../../src/framework/prompter.js';

describe('prompter', () => {
  it('throws UserError when non-interactive and a prompt is requested', async () => {
    const p = createPrompter({ isTTY: false, nonInteractive: true });
    await expect(p.select({ message: 'pick', choices: ['a', 'b'] })).rejects.toBeInstanceOf(UserError);
  });
  it('throws UserError when stdin is not a TTY even without --non-interactive', async () => {
    const p = createPrompter({ isTTY: false, nonInteractive: false });
    await expect(p.confirm({ message: 'yes?', defaultValue: true })).rejects.toBeInstanceOf(UserError);
  });
});
