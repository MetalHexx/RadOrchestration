import fs from 'node:fs';
import path from 'node:path';
import { defineCommand } from '../../framework/command.js';
import { userDataPaths } from '../../lib/paths.js';
import type { CommandContext } from '../../framework/context.js';

export interface ConfigResult { autoCommit: string; autoPr: string; }
export interface ReadConfigOpts { root: string; }

function readScalar(content: string, group: string, key: string): string | null {
  const lines = content.split('\n');
  let inGroup = false;
  for (const raw of lines) {
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;
    const indent = raw.search(/\S/);
    const trimmed = raw.trim();
    if (indent === 0) inGroup = trimmed === `${group}:`;
    else if (inGroup) {
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
      if (m && m[1] === key) return (m[2] ?? '').replace(/\s+#.*$/, '').replace(/^["'](.*)["']$/, '$1').trim() || null;
    }
  }
  return null;
}

export function readConfig({ root }: ReadConfigOpts): ConfigResult {
  const configPath = path.join(root, 'orchestration.yml');
  let autoCommit = 'ask';
  let autoPr = 'ask';
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    autoCommit = readScalar(content, 'source_control', 'auto_commit') ?? autoCommit;
    autoPr = readScalar(content, 'source_control', 'auto_pr') ?? autoPr;
  }
  return { autoCommit, autoPr };
}

export const configCommand = defineCommand({
  name: 'config',
  description: 'Read decision-relevant orchestration.yml config values (auto_commit, auto_pr)',
  args: {},
  flags: {},
  handler: async (_: { args: Record<string, never>; flags: Record<string, never>; ctx: CommandContext }) =>
    readConfig({ root: userDataPaths().root }),
});
