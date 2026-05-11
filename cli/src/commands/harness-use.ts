import fs from 'node:fs/promises';
import { writeFileAtomic, pathExists } from '../lib/fs-helpers.js';
import { installPaths, resolveInstallRoot } from '../lib/paths.js';
import { UserError } from '../framework/errors.js';
import { HarnessName, isHarnessName } from '../framework/harness.js';
import { defineCommand } from '../framework/command.js';
import type { CommandContext } from '../framework/context.js';

export interface HarnessUseResult { active: HarnessName; no_change: boolean }
export interface HarnessListResult { harnesses: { name: HarnessName; active: boolean }[] }

export async function runHarnessUse(opts: { harness: string }): Promise<HarnessUseResult> {
  if (!isHarnessName(opts.harness)) {
    throw new UserError(`Unknown harness "${opts.harness}". Expected one of: ${HarnessName.join(', ')}.`);
  }
  const root = resolveInstallRoot();
  const p = installPaths(root);
  if (!(await pathExists(p.installJson))) {
    throw new UserError(`radorch install root not found at ${root}. Run \`radorch install\` first.`);
  }
  const current = (await fs.readFile(p.harnessPointer, 'utf8').catch(() => '')).trim();
  if (current === opts.harness) return { active: opts.harness, no_change: true };
  await writeFileAtomic(p.harnessPointer, opts.harness + '\n');
  return { active: opts.harness, no_change: false };
}

export async function runHarnessList(): Promise<HarnessListResult> {
  const root = resolveInstallRoot();
  const p = installPaths(root);
  if (!(await pathExists(p.installJson))) {
    throw new UserError(`radorch install root not found at ${root}. Run \`radorch install\` first.`);
  }
  const active = (await fs.readFile(p.harnessPointer, 'utf8').catch(() => '')).trim();
  return {
    harnesses: HarnessName.map((name) => ({ name, active: name === active })),
  };
}

export const harnessUseCommand = defineCommand({
  name: 'harness-use',
  description: 'Switch the active harness without re-installing',
  args: { harness: { description: 'harness name (claude | copilot-vscode | copilot-cli)', required: true } },
  flags: {},
  handler: async ({ args, ctx }: { args: { harness: string }; ctx: CommandContext }) => {
    const result = await runHarnessUse({ harness: args.harness });
    if (result.no_change && !ctx.ux.json) {
      ctx.stderr.write(ctx.theme.hint(`harness "${result.active}" is already active — no change\n`));
    }
    return result;
  },
});
