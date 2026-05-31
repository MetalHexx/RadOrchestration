import { deriveArtifacts, type Artifact } from '@/lib/artifact-model';

export interface ArtifactSnapshot {
  files: string[];
  artifacts: Artifact[];
}

export async function fetchArtifactSnapshot(
  projectName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ArtifactSnapshot> {
  const res = await fetchImpl(`/api/projects/${encodeURIComponent(projectName)}/files`);
  if (!res.ok) return { files: [], artifacts: [] };
  const data = (await res.json()) as { files: string[]; mtimes?: Record<string, number> };
  const files = data.files ?? [];
  const artifacts = deriveArtifacts(projectName, files, data.mtimes ?? {});
  return { files, artifacts };
}

/** Self-heal: a reconnect snapshot drops unseen entries for files that are gone. */
export function reconcileUnseen(unseen: Set<string>, currentFiles: string[]): Set<string> {
  const present = new Set(currentFiles);
  const next = new Set<string>();
  for (const f of unseen) if (present.has(f)) next.add(f);
  return next;
}
