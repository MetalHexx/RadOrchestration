import { join, isAbsolute } from 'node:path';
import type { PreReadResult, EventContext, EventIndexEntry, IOAdapter } from './types.js';
import { validateFrontmatter } from './frontmatter-validators.js';

function extractMasterPlanDocPath(state: unknown): string | undefined {
  if (typeof state !== 'object' || state === null) return undefined;
  const s = state as Record<string, unknown>;
  if (typeof s.graph !== 'object' || s.graph === null) return undefined;
  const g = s.graph as Record<string, unknown>;
  if (typeof g.nodes !== 'object' || g.nodes === null) return undefined;
  const n = g.nodes as Record<string, unknown>;
  if (typeof n.master_plan !== 'object' || n.master_plan === null) return undefined;
  const mp = n.master_plan as Record<string, unknown>;
  return typeof mp.doc_path === 'string' ? mp.doc_path : undefined;
}

export function preRead(
  event: string,
  context: Partial<EventContext>,
  readDocument: IOAdapter['readDocument'],
  projectDir: string,
  state: unknown,
  entry: EventIndexEntry
): PreReadResult {
  if (event === 'plan_approved' && (!context.doc_path || context.doc_path.trim() === '')) {
    const derived = extractMasterPlanDocPath(state);
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
