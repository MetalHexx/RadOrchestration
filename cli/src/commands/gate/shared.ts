import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processEvent } from '../../../../harness-files/skills/rad-orchestration/scripts/lib/engine.js';
import {
  readState, writeState, readConfig, readDocument, ensureDirectories,
} from '../../../../harness-files/skills/rad-orchestration/scripts/lib/state-io.js';
import type {
  IOAdapter, PathContext, PipelineResult,
} from '../../../../harness-files/skills/rad-orchestration/scripts/lib/types.js';

export { processEvent };
export type { PipelineResult };

/**
 * AD-6: radorch gate approve resolves all paths from --project-dir + the
 * bundle's own import.meta.url; the process cwd is never consulted. Mirrors
 * pipeline.ts's resolvePathContext() so both entry points share path math.
 * templatesDir points at ~/.radorch/templates/ (the user-data root), not the
 * skill folder — matching the runtime resolution in pipeline.ts.
 */
export function resolvePathContext(): PathContext {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.join(os.homedir(), '.radorch', 'templates');
  // PathContext.orchRoot is documented as the absolute path to the orchestration
  // install root, matching pipeline.ts's resolvePathContext(). It bubbles into
  // PipelineResult.orchRoot, so returning a basename would mislead any consumer
  // that resolves references off it.
  const orchRoot = path.resolve(scriptsDir, '..', '..', '..');
  return { scriptsDir, templatesDir, orchRoot };
}

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
