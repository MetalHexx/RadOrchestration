import { readRegistry, resolveRepoPath } from '../../../../lib/repo-registry/src/index.js';

export interface RenderPreambleOpts { root: string }

/**
 * Pure function that builds the session-context preamble string.
 *
 * The preamble is delivered to the assistant on the session-start hook's
 * additionalContext channel. It is voiced as an assistant-directed relay
 * directive (not passive status text) so the assistant announces it to the
 * user at the start of its first reply rather than treating it as silent
 * ambient context.
 *
 * Registry-present path (FR-14, DD-1): directive to summarize, then a concise
 *   facts block — repo names with unbound entries flagged, repo-groups with
 *   members, and counts. Local paths and descriptions are intentionally omitted
 *   for brevity; the assistant summarizes in its own voice and points to
 *   /rad-repo.
 *
 * Empty-state path (FR-15): directive to announce that nothing is registered,
 *   why it matters, and to offer to help register the first repo via /rad-repo.
 */
export function renderPreamble({ root }: RenderPreambleOpts): string {
  const reg = readRegistry({ root });
  const repoNames = Object.keys(reg.repos);
  const groupNames = Object.keys(reg.repoGroups);

  if (repoNames.length === 0) {
    // Empty-state: assistant-directed announcement + offer to help (FR-15).
    return (
      '[rad-orc session-start] At the start of your first reply, briefly tell the user that ' +
      'Rad Orc is live but no repositories are registered yet, so you cannot work across their ' +
      'repos until at least one is added. Offer to help them register their first repo with ' +
      '/rad-repo (and walk them through it if they accept). Keep it short, then continue with ' +
      'their request.'
    );
  }

  // Registry present — assistant-directed summary directive + concise facts (DD-1).
  const resolved = repoNames.map((name) => resolveRepoPath(reg, name));
  const unboundCount = resolved.filter((r) => !r.bound).length;

  const lines: string[] = [];
  lines.push(
    '[rad-orc session-start] At the start of your first reply, give the user a brief, friendly ' +
    'summary of their registered Rad Orc repos below (in your own words, a couple of lines), then ' +
    'mention /rad-repo to manage them. Continue with their request after.',
  );
  lines.push('');
  lines.push(`Repos (${repoNames.length} total, ${unboundCount} unbound):`);
  for (const r of resolved) {
    lines.push(r.bound ? `  ${r.name}` : `  ${r.name}  [unbound]`);
  }

  if (groupNames.length > 0) {
    lines.push(`Repo-groups (${groupNames.length}):`);
    for (const groupName of groupNames) {
      const grp = reg.repoGroups[groupName]!;
      const memberList = grp.members.length > 0 ? grp.members.join(', ') : '(empty)';
      lines.push(`  ${groupName}: ${memberList}`);
    }
  }

  return lines.join('\n');
}
