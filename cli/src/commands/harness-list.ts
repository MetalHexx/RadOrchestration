import { defineCommand } from '../framework/command.js';
import type { CommandContext } from '../framework/context.js';
import { runHarnessList } from './harness-use.js';

function renderTable(rows: { name: string; active: boolean }[], ctx: CommandContext): void {
  if (!ctx.ux.isTTY || ctx.ux.nonInteractive || ctx.ux.json) return;
  const w = Math.max(...rows.map((r) => r.name.length));
  ctx.stderr.write(`${'name'.padEnd(w)}  active\n`);
  for (const r of rows) {
    const line = `${r.name.padEnd(w)}  ${r.active ? ctx.theme.success('yes') : 'no'}\n`;
    ctx.stderr.write(line);
  }
}

export const harnessListCommand = defineCommand({
  name: 'harness-list',
  description: 'List installed harnesses and which is active',
  args: {},
  flags: {},
  handler: async ({ ctx }: { ctx: CommandContext }) => {
    const result = await runHarnessList();
    renderTable(result.harnesses, ctx);
    return result;
  },
});
