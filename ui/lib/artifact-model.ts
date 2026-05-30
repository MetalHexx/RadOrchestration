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

function isRootFile(relPath: string): boolean {
  return !relPath.includes('/');
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
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

  return out;
}
