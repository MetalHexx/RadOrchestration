import { processEvent } from '../../lib/pipeline/engine.js';
import {
  readState, writeState, readConfig, readDocument, ensureDirectories,
} from '../../lib/pipeline/state-io.js';
import { resolvePathContext } from '../../lib/pipeline/path-context.js';
import type { IOAdapter, PathContext, PipelineResult } from '../../lib/pipeline/types.js';

export { processEvent, resolvePathContext };
export type { PathContext, PipelineResult };

export function makeIO(): IOAdapter {
  return { readState, writeState, readConfig, readDocument, ensureDirectories };
}

export function autoResolveMasterPlanDocPath(state: unknown): string | undefined {
  const s = state as { graph?: { nodes?: Record<string, { doc_path?: string } | undefined> } } | null;
  return s?.graph?.nodes?.['master_plan']?.doc_path;
}

export function autoResolveFinalReviewDocPath(state: unknown): string | undefined {
  const s = state as { graph?: { nodes?: Record<string, { doc_path?: string } | undefined> } } | null;
  return s?.graph?.nodes?.['final_review']?.doc_path;
}
