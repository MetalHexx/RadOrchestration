import { join, isAbsolute } from 'node:path';
import type { PreReadResult, EventContext, EventIndexEntry, IOAdapter } from './types.js';

export function preRead(
  event: string,
  context: Partial<EventContext>,
  readDocument: IOAdapter['readDocument'],
  projectDir: string,
  entry: EventIndexEntry
): PreReadResult {
  if (entry.eventPhase === 'started' || entry.eventPhase === 'approved') {
    return { context };
  }

  const { nodeDef } = entry;
  if (nodeDef.kind !== 'step' || !nodeDef.doc_output_field) {
    return { context };
  }

  if (!context.doc_path || context.doc_path.trim() === '') {
    return {
      context,
      error: {
        message: "Pre-read failed: missing required field 'doc_path' in event context",
        event,
        field: 'doc_path',
      },
    };
  }

  const resolvedPath = isAbsolute(context.doc_path)
    ? context.doc_path
    : join(projectDir, context.doc_path);

  const doc = readDocument(resolvedPath);
  if (doc === null) {
    return {
      context,
      error: {
        message: `Pre-read failed: document not found or unreadable: ${resolvedPath}`,
        event,
        field: 'doc_path',
      },
    };
  }

  const enrichedContext = { ...doc.frontmatter, ...context } as Partial<EventContext>;
  return { context: enrichedContext };
}
