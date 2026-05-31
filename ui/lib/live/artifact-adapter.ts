import path from 'node:path';
import type { RawWatchEvent } from './shared-watcher';

export type ArtifactEventKind = 'added' | 'changed' | 'removed';
export interface ArtifactSemanticEvent {
  topic: string;
  kind: ArtifactEventKind;
  projectName: string;
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
  return { topic: topicForProject(projectName), kind: KIND_MAP[e.type], projectName };
}
