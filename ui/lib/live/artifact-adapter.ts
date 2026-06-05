import path from 'node:path';
import type { RawWatchEvent } from './shared-watcher';

export type ArtifactEventKind = 'added' | 'changed' | 'removed';
export interface ArtifactSemanticEvent {
  topic: string;
  kind: ArtifactEventKind;
  projectName: string;
  // Optional generic payload the hub carries alongside the topic so non-artifact
  // topics (state, lifecycle) can ride the same per-topic coalescing + bounded
  // queue. Artifact events leave this undefined; state/lifecycle publishers parse
  // once at the hub and attach the ready-to-deliver notification here.
  notif?: unknown;
}

export function topicForProject(projectName: string): string {
  return `artifacts:${projectName}`;
}

const KIND_MAP: Record<RawWatchEvent['type'], ArtifactEventKind> = {
  add: 'added',
  change: 'changed',
  unlink: 'removed',
};

export function classifyArtifactEvent(
  e: RawWatchEvent,
  projectsRoot: string,
): ArtifactSemanticEvent | null {
  const rel = path.relative(projectsRoot, e.filePath);
  const segments = rel.split(/[\\/]/).filter(Boolean);
  if (segments.length < 2) return null; // not inside a project directory
  const projectName = segments[0];

  // Align with deriveArtifacts: only root-level .md/.html files are artifacts.
  // Nested files (segments > 2), non-.md/.html extensions, and the high-frequency
  // state.json write are never surfaced by deriveArtifacts — skip them here too.
  if (segments.length > 2) return null;
  const basename = segments[1];
  if (basename === 'state.json') return null;
  if (!basename.endsWith('.md') && !basename.endsWith('.html')) return null;

  return { topic: topicForProject(projectName), kind: KIND_MAP[e.type], projectName };
}
