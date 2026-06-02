import { readRegistry, resolveRepoPath } from '../../../../lib/repo-registry/src/index.js';

export interface RenderPreambleOpts { root: string }

// The preamble is delivered to the assistant on the session-start hook's
// additionalContext channel. It carries the EXACT user-facing message plus a
// benign delivery directive telling the assistant to open its first reply with
// that message — so the greeting is controlled and consistent rather than
// improvised fresh each session.
//
// The directive is framed as a relay ("begin your first reply by giving the
// user this message"), never as "echo this exactly / you must comply" — the
// coercive framing trips the assistant's prompt-injection guard.
//
// Empty-state path (FR-15): a warm, verbatim greeting that names the gap (no
//   map beyond the cwd) and offers /rad-repo.
// Registry-present path (FR-14, DD-1): a verbatim greeting whose only dynamic
//   parts are the repo/repo-group slug lists and the unbound-repo nudge. Local
//   paths and descriptions are intentionally omitted for brevity.
const DELIVERY_PREFIX =
  '[rad-orc session-start] Begin your first reply by giving the user this message, ' +
  'then continue with their request:\n\n';

const code = (slug: string): string => `\`${slug}\``;

/** Backticked slugs joined inline: "`a`, `b`, `c`". */
function slugList(slugs: string[]): string {
  return slugs.map(code).join(', ');
}

/** Backticked slugs joined for prose: "`a`", "`a` and `b`", "`a`, `b`, and `c`". */
function andList(slugs: string[]): string {
  const coded = slugs.map(code);
  if (coded.length <= 1) return coded.join('');
  if (coded.length === 2) return `${coded[0]} and ${coded[1]}`;
  return `${coded.slice(0, -1).join(', ')}, and ${coded[coded.length - 1]}`;
}

export function renderPreamble({ root }: RenderPreambleOpts): string {
  const reg = readRegistry({ root });
  const repoNames = Object.keys(reg.repos);
  const groupNames = Object.keys(reg.repoGroups);

  if (repoNames.length === 0) {
    // Empty-state: warm verbatim greeting that names the gap and offers /rad-repo.
    const body =
      "**Rad Orc is ready!** Right now I can only see the folder we're in — there aren't any " +
      "repositories registered yet, so I don't yet have a map of your other repos or a way to plan " +
      "and make changes across them. Want to register your first one? Just say **`/rad-repo`** and " +
      "I'll walk you through it.";
    return DELIVERY_PREFIX + body;
  }

  // Registry present — verbatim greeting; only the slug lists and the unbound
  // nudge vary with the data.
  const resolved = repoNames.map((name) => resolveRepoPath(reg, name));
  const unbound = resolved.filter((r) => !r.bound);

  const repoNoun = repoNames.length === 1 ? 'repository' : 'repositories';
  let lead =
    `**Rad Orc is ready — your repo map is loaded.** You've got ` +
    `**${repoNames.length} ${repoNoun}** — ${slugList(repoNames)}`;
  if (groupNames.length > 0) {
    const groupNoun = groupNames.length === 1 ? 'repo-group' : 'repo-groups';
    lead += ` — and **${groupNames.length} ${groupNoun}**: ${slugList(groupNames)}.`;
  } else {
    lead += '.';
  }

  const reach =
    ' These are the repos I can reach beyond the current folder and reason across as we work.';

  let closing: string;
  if (unbound.length === 0) {
    closing = ' Say **`/rad-repo`** anytime to review or update your repos.';
  } else if (unbound.length === 1) {
    closing =
      `\n\nOne thing to sort out: ${andList(unbound.map((r) => r.name))} isn't bound to a local ` +
      `folder on this machine yet, so I can't open its code until it is. Say **\`/rad-repo\`** and ` +
      `I'll help you point it at the right clone.`;
  } else {
    closing =
      `\n\nOne thing to sort out: ${andList(unbound.map((r) => r.name))} aren't bound to local ` +
      `folders on this machine yet, so I can't open their code until they are. Say **\`/rad-repo\`** ` +
      `and I'll help you point them at the right clones.`;
  }

  return DELIVERY_PREFIX + lead + reach + closing;
}
