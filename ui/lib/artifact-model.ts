export type ArtifactKind = 'markdown' | 'visual' | 'wireframe' | 'html';

export interface Artifact {
  /** Project-root filename, e.g. "DEMO-WIREFRAME-LAUNCH-SCREEN.html". */
  fileName: string;
  kind: ArtifactKind;
  /** Locked type label per FR-3. */
  label: string;
  /** Humanized title (wireframes only); null otherwise. */
  title: string | null;
  /** True for .md (renders via markdown renderer), false for .html (iframe). */
  isMarkdown: boolean;
}

/**
 * Planner/pipeline-generated root docs that must NOT surface as artifacts.
 *
 * Markdown selection is a DENYLIST: every root `.md` is surfaced as a generic
 * doc EXCEPT files whose name ends with one of these `${project}-…` suffixes.
 * These are pipeline outputs (requirements, the master plan, the plan audit,
 * the error log) — audit-trail docs, not brainstorming artifacts. Extend this
 * list to hide additional pipeline-generated root docs.
 *
 * Note: tasks/phases/reports stay out via the root-only filter (they live in
 * subfolders), so they are intentionally absent here.
 */
export const PIPELINE_DOC_SUFFIXES = [
  '-REQUIREMENTS.md',
  '-MASTER-PLAN.md',
  '-PLAN-AUDIT.md',
  '-ERROR-LOG.md',
] as const;

function isRootFile(relPath: string): boolean {
  return !relPath.includes('/');
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Strip the leading `${project}-` prefix and the given extension (.html/.md). */
function stripProjectPrefix(fileName: string, project: string, ext: RegExp): string {
  const base = fileName.replace(ext, '');
  const prefix = `${project}-`;
  return base.startsWith(prefix) ? base.slice(prefix.length) : base;
}

function isPipelineDoc(fileName: string, project: string): boolean {
  return PIPELINE_DOC_SUFFIXES.some((suffix) => fileName === `${project}${suffix}`);
}

export function deriveArtifacts(
  project: string,
  files: string[],
  mtimes: Record<string, number>,
): Artifact[] {
  const brainstormingMd = `${project}-BRAINSTORMING.md`;
  const brainstormVisual = `${project}-BRAINSTORM.html`;
  const wireframeRe = new RegExp(`^${project}-WIREFRAME-(.+)\\.html$`);

  const root = files.filter(isRootFile);
  const out: Artifact[] = [];

  if (root.includes(brainstormingMd)) {
    out.push({ fileName: brainstormingMd, kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true });
  }
  if (root.includes(brainstormVisual)) {
    out.push({ fileName: brainstormVisual, kind: 'visual', label: 'Brainstorm Visual', title: null, isMarkdown: false });
  }

  const wireframes = root
    .map((f) => ({ f, m: wireframeRe.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => x.m !== null)
    .sort((a, b) => (mtimes[a.f] ?? 0) - (mtimes[b.f] ?? 0))
    .map(({ f, m }) => ({
      fileName: f,
      kind: 'wireframe' as const,
      label: 'Wireframe',
      title: humanizeSlug(m[1]),
      isMarkdown: false,
    }));
  out.push(...wireframes);

  // Trailing "other docs" group: every remaining root .html and .md, EXCEPT
  // the pipeline denylist (.md) — merged and ordered by mtime asc so mixed
  // .md/.html share one deterministic trailing sequence.
  const captured = new Set(out.map((a) => a.fileName));
  const otherDocs = root
    .filter((f) => !captured.has(f))
    .filter((f) => {
      if (f.endsWith('.html')) return true;
      if (f.endsWith('.md')) return !isPipelineDoc(f, project);
      return false;
    })
    .sort((a, b) => (mtimes[a] ?? 0) - (mtimes[b] ?? 0))
    .map((f): Artifact => {
      if (f.endsWith('.md')) {
        const slug = stripProjectPrefix(f, project, /\.md$/i);
        return {
          fileName: f,
          kind: 'markdown',
          label: 'Doc',
          title: slug ? humanizeSlug(slug) : null,
          isMarkdown: true,
        };
      }
      const slug = stripProjectPrefix(f, project, /\.html$/i);
      return {
        fileName: f,
        kind: 'html',
        label: 'Visual',
        title: slug ? humanizeSlug(slug) : null,
        isMarkdown: false,
      };
    });
  out.push(...otherDocs);

  return out;
}
