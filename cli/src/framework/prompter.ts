import { confirm, input, select } from '@inquirer/prompts';
import { UserError } from './errors.js';

export interface PrompterOptions {
  isTTY: boolean;
  nonInteractive: boolean;
}
export interface Prompter {
  input(opts: { message: string; default?: string }): Promise<string>;
  confirm(opts: { message: string; defaultValue: boolean }): Promise<boolean>;
  select<T extends string>(opts: { message: string; choices: readonly T[]; default?: T }): Promise<T>;
}

export function createPrompter(opts: PrompterOptions): Prompter {
  function gate(missing: string): never {
    throw new UserError(`Missing required input "${missing}". Re-run with the matching flag or in an interactive terminal.`);
  }
  const allowed = opts.isTTY && !opts.nonInteractive;
  return {
    async input(o) {
      if (!allowed) gate(o.message);
      return input({ message: o.message, default: o.default });
    },
    async confirm(o) {
      if (!allowed) gate(o.message);
      return confirm({ message: o.message, default: o.defaultValue });
    },
    async select(o) {
      if (!allowed) gate(o.message);
      const choice = await select({ message: o.message, choices: o.choices.map((c) => ({ value: c, name: c })), default: o.default });
      return choice as Awaited<ReturnType<Prompter['select']>>;
    },
  };
}
