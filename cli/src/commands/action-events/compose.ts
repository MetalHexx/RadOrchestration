import fs from 'node:fs';
import { defineCommand } from '../../framework/command.js';
import { UserError } from '../../framework/errors.js';
import type { CommandContext } from '../../framework/context.js';
import {
  composeActionPrompt,
  composeOrphanEventPrompt,
  composeOrphanRuntimeShape,
} from '../../lib/pipeline-engine/composer.js';
import type { ComposeResult } from '../../lib/pipeline-engine/composer.js';
import { userDataPaths } from '../../lib/paths.js';
import { validateKind, validateName } from './validators.js';

interface Flags {
  kind?: string;
  name?: string;
  'completion-event'?: string;
  'catalog-root'?: string;
  mode?: string;
}

export type ComposeMode = 'standalone' | 'runtime-orphan';

export type { ComposeResult } from '../../lib/pipeline-engine/composer.js';

export interface ComposeInputs {
  catalogRoot: string;
  kind: 'action' | 'event';
  name: string;
  completionEvent: string | null;
  overlay?: Record<string, string>;
  mode?: ComposeMode;
}

function validateMode(raw: string | undefined): ComposeMode {
  if (raw === undefined || raw === '') return 'standalone';
  if (raw !== 'standalone' && raw !== 'runtime-orphan') {
    throw new UserError(`--mode must be 'standalone' or 'runtime-orphan' (got '${raw}')`);
  }
  return raw;
}

export function runCompose(input: ComposeInputs): ComposeResult {
  const mode = input.mode ?? 'standalone';
  if (mode === 'runtime-orphan' && input.kind !== 'event') {
    throw new UserError(`--mode runtime-orphan is only valid for --kind event`);
  }
  if (input.kind === 'action') {
    return composeActionPrompt({
      actionName: input.name,
      completionEvent: input.completionEvent,
      catalogRoot: input.catalogRoot,
      overlay: input.overlay,
    });
  }
  if (mode === 'runtime-orphan') {
    return composeOrphanRuntimeShape({
      eventName: input.name,
      catalogRoot: input.catalogRoot,
      overlay: input.overlay,
    });
  }
  return composeOrphanEventPrompt({
    eventName: input.name,
    catalogRoot: input.catalogRoot,
    overlay: input.overlay,
  });
}

function readOptionalStdinJson(): Record<string, unknown> {
  if (process.stdin.isTTY) return {};
  let raw = '';
  try { raw = fs.readFileSync(0, 'utf8'); } catch { return {}; }
  if (!raw.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new UserError(`invalid JSON on stdin: ${(e as Error).message}`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new UserError('stdin JSON must be an object');
  }
  return parsed as Record<string, unknown>;
}

export const composeCommand = defineCommand({
  name: 'compose',
  description: 'Compose an action or orphan-event prompt (optional {overlay} on stdin)',
  args: {},
  flags: {
    kind: { description: "'action' or 'event'", type: 'string' as const },
    name: { description: 'entry name (matches /^[a-z0-9_]+$/)', type: 'string' as const },
    'completion-event': { description: 'completion event name for action kind (ignored for event)', type: 'string' as const },
    'catalog-root': { description: 'absolute path to the action-events catalog root', type: 'string' as const },
    mode: { description: "'standalone' (default) or 'runtime-orphan' (event-only)", type: 'string' as const },
  },
  handler: async ({ flags }: { flags: Flags; ctx: CommandContext }): Promise<ComposeResult> => {
    const kind = validateKind(flags.kind);
    const name = validateName(flags.name);
    const mode = validateMode(flags.mode);
    const root = flags['catalog-root'] || userDataPaths().actionEvents;
    const stdin = readOptionalStdinJson();
    const overlayRaw = stdin['overlay'];
    let overlay: Record<string, string> | undefined;
    if (overlayRaw !== undefined) {
      if (!overlayRaw || typeof overlayRaw !== 'object' || Array.isArray(overlayRaw)) {
        throw new UserError('stdin `overlay` must be a string-keyed object when present');
      }
      for (const [k, v] of Object.entries(overlayRaw as Record<string, unknown>)) {
        if (typeof v !== 'string') throw new UserError(`stdin overlay['${k}'] must be a string`);
      }
      overlay = overlayRaw as Record<string, string>;
    }
    const completionEvent = flags['completion-event'] ?? null;
    return runCompose({ catalogRoot: root, kind, name, completionEvent, overlay, mode });
  },
});
