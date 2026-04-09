import { join, isAbsolute } from 'node:path';
import { readFileSync } from 'node:fs';
import type { PreReadResult, EventContext, EventIndexEntry, IOAdapter } from './types.js';
import { validateFrontmatter } from './frontmatter-validators.js';

export function preRead(
  event: string,
  context: Partial<EventContext>,
  readDocument: IOAdapter['readDocument'],
  projectDir: string,
  entry: EventIndexEntry
): PreReadResult {
  if (event === 'plan_approved' && (!context.doc_path || context.doc_path.trim() === '')) {
    let stateRaw: string;
    try {
      stateRaw = readFileSync(join(projectDir, 'state.json'), 'utf-8');
    } catch {
      return {
        context,
        error: {
          message: `Cannot derive master plan path: state.json unreadable at '${projectDir}'`,
          event: 'plan_approved',
          field: 'doc_path',
        },
      };
    }

    let state: unknown;
    try {
      state = JSON.parse(stateRaw);
    } catch {
      return {
        context,
        error: {
          message: 'Cannot derive master plan path: state.json is not valid JSON',
          event: 'plan_approved',
          field: 'doc_path',
        },
      };
    }

    const derived = (state as any)?.graph?.nodes?.master_plan?.doc_path;
    if (!derived) {
      return {
        context,
        error: {
          message: 'Cannot derive master plan path: graph.nodes.master_plan.doc_path is not set',
          event: 'plan_approved',
          field: 'doc_path',
        },
      };
    }

    context = { ...context, doc_path: isAbsolute(derived) ? derived : join(projectDir, derived) };
  }

  // Validate total_phases for plan_approved before early return
  if (event === 'plan_approved' && context.doc_path) {
    const resolvedPath = isAbsolute(context.doc_path)
      ? context.doc_path
      : join(projectDir, context.doc_path);

    const doc = readDocument(resolvedPath);
    if (doc) {
      const enrichedContext = { ...doc.frontmatter, ...context } as Record<string, unknown>;
      const validationError = validateFrontmatter(event, enrichedContext, resolvedPath);
      if (validationError) {
        return {
          context: enrichedContext as Partial<EventContext>,
          error: {
            message: validationError.error,
            event: validationError.event,
            field: validationError.field,
          },
        };
      }
      // Merge frontmatter into context for downstream consumption
      context = enrichedContext as Partial<EventContext>;
    }
  }

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

  const validationError = validateFrontmatter(event, enrichedContext as Record<string, unknown>, resolvedPath);
  if (validationError) {
    return {
      context: enrichedContext,
      error: {
        message: validationError.error,
        event: validationError.event,
        field: validationError.field,
      },
    };
  }

  return { context: enrichedContext };
}
