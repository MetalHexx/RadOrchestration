import { processEvent } from '../../lib/pipeline/engine.js';
import {
  readState, writeState, readConfig, readDocument, ensureDirectories,
} from '../../lib/pipeline/state-io.js';
import { resolvePathContext, resolveDiscoveredConfigPath } from '../../lib/pipeline/path-context.js';
import type { EventContext, IOAdapter, PathContext, PipelineResult } from '../../lib/pipeline/types.js';

export interface PipelineSignalInput {
  event: string;
  projectDir: string;
  context: Partial<EventContext>;
  io?: IOAdapter;
  pathContext?: PathContext;
  configPath?: string;
}

export type PipelineSignalEnvelope =
  | { ok: true; data: { action: string | null; context: Record<string, unknown> } }
  | { ok: false; data: { event: string; field?: string }; error: { type: 'user_error'; message: string } };

export function makeDefaultIO(): IOAdapter {
  return { readState, writeState, readConfig, readDocument, ensureDirectories };
}

export async function pipelineSignal(input: PipelineSignalInput): Promise<PipelineSignalEnvelope> {
  const io = input.io ?? makeDefaultIO();
  const pathContext = input.pathContext ?? resolvePathContext();
  const configPath = input.configPath ?? resolveDiscoveredConfigPath();
  let result: PipelineResult;
  try {
    result = processEvent(input.event, input.projectDir, input.context, io, pathContext, configPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, data: { event: input.event || 'unknown' }, error: { type: 'user_error', message } };
  }
  if (result.error) {
    return {
      ok: false,
      data: { event: result.error.event, ...(result.error.field ? { field: result.error.field } : {}) },
      error: { type: 'user_error', message: result.error.message },
    };
  }
  return { ok: true, data: { action: result.action, context: result.context } };
}
