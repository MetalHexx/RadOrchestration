import { readRegistry, resolveRepoPath } from '../../../../lib/repo-registry/src/index.js';

export interface RenderPreambleOpts { root: string }

/**
 * Pure function that builds the session-context preamble string.
 *
 * Registry-present path (FR-14, DD-1, DD-2, DD-3):
 *   - Friendly init line
 *   - ~/.radorc/projects/ awareness line
 *   - Concise inline block of repos (bound flagged with path, unbound flagged "[unbound]")
 *   - Concise inline block of repo-groups with their members
 *   - Closing /rad-repo pointer line
 *
 * Empty-state path (FR-15, DD-2):
 *   - Friendly init line
 *   - Nudge to /rad-repo to register a first repo
 */
export function renderPreamble({ root }: RenderPreambleOpts): string {
  const reg = readRegistry({ root });
  const repoNames = Object.keys(reg.repos);
  const groupNames = Object.keys(reg.repoGroups);

  const lines: string[] = [];

  lines.push('Rad Orc Initialized!');
  lines.push(`Projects are tracked under ~/.radorc/projects/`);
  lines.push('');

  if (repoNames.length === 0) {
    // Empty-state nudge (FR-15)
    lines.push('No repos registered yet. Use /rad-repo to register your first repo.');
    return lines.join('\n');
  }

  // Registry present — concise block (DD-1)
  lines.push('Registered repos:');
  for (const name of repoNames) {
    const resolved = resolveRepoPath(reg, name);
    if (resolved.bound) {
      lines.push(`  ${name}  (${resolved.path})`);
    } else {
      lines.push(`  ${name}  [unbound]`);
    }
  }

  if (groupNames.length > 0) {
    lines.push('');
    lines.push('Repo-groups:');
    for (const groupName of groupNames) {
      const grp = reg.repoGroups[groupName]!;
      const memberList = grp.members.length > 0 ? grp.members.join(', ') : '(empty)';
      lines.push(`  ${groupName}: ${memberList}`);
    }
  }

  // Contractual /rad-repo pointer on every registry-present path (DD-2)
  lines.push('');
  lines.push('Use /rad-repo to manage repos and groups.');

  return lines.join('\n');
}
