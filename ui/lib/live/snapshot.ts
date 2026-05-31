import { deriveArtifacts, type Artifact } from '@/lib/artifact-model';

export interface ArtifactSnapshot {
  files: string[];
  artifacts: Artifact[];
  mtimes: Record<string, number>;
}

export interface SnapshotChange {
  fileName: string;
  kind: 'added' | 'changed' | 'removed';
}

export async function fetchArtifactSnapshot(
  projectName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArtifactSnapshot> {
  const res = await fetchImpl(`/api/projects/${encodeURIComponent(projectName)}/files`);
  if (!res.ok) return { files: [], artifacts: [], mtimes: {} };
  const data = (await res.json()) as { files: string[]; mtimes?: Record<string, number> };
  const files = data.files ?? [];
  const mtimes = data.mtimes ?? {};
  const artifacts = deriveArtifacts(projectName, files, mtimes);
  return { files, artifacts, mtimes };
}

/** Self-heal: a reconnect snapshot drops unseen entries for files that are gone. */
export function reconcileUnseen(unseen: Set<string>, currentFiles: string[]): Set<string> {
  const present = new Set(currentFiles);
  const next = new Set<string>();
  for (const f of unseen) if (present.has(f)) next.add(f);
  return next;
}

/**
 * Derive per-file changes between two snapshots. A live `artifact_change`
 * notification carries no filename, so the provider compares the freshly pulled
 * snapshot against the previous one: a new file is `added`, a file whose mtime
 * advanced is `changed`, and a file that disappeared is `removed`. An unchanged
 * file emits nothing.
 */
export function diffSnapshots(
  prevFiles: string[],
  prevMtimes: Record<string, number>,
  nextFiles: string[],
  nextMtimes: Record<string, number>,
): SnapshotChange[] {
  const prevSet = new Set(prevFiles);
  const nextSet = new Set(nextFiles);
  const changes: SnapshotChange[] = [];
  for (const f of nextFiles) {
    if (!prevSet.has(f)) changes.push({ fileName: f, kind: 'added' });
    else if ((nextMtimes[f] ?? 0) > (prevMtimes[f] ?? 0)) changes.push({ fileName: f, kind: 'changed' });
  }
  for (const f of prevFiles) {
    if (!nextSet.has(f)) changes.push({ fileName: f, kind: 'removed' });
  }
  return changes;
}
