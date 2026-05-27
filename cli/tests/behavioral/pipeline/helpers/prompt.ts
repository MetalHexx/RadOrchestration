// cli/tests/behavioral/pipeline/helpers/prompt.ts
//
// Shared assertion helper for the per-envelope `data.prompt` + `data.completion_event`
// contract (FR-4, FR-5, FR-9, FR-23). Every successful pipeline envelope under
// behavioral/pipeline/events/ carries these two fields. Non-terminal actions
// must include a `Signal: <event>` line in the composed prompt (the completion
// event the orchestrator is expected to signal next); terminal actions (e.g.
// display_halted, display_complete) carry `completion_event: null` and the
// composed prompt omits both the `## When complete` heading and the
// `Signal:` line entirely.

import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { realCatalogRoot } from './catalog.js';

type Envelope = { ok: boolean; data?: unknown; error?: unknown };

function getData(env: Envelope): Record<string, unknown> {
  expect(env.ok, 'envelope.ok').toBe(true);
  const data = env.data as Record<string, unknown> | undefined;
  expect(data, 'envelope.data').toBeDefined();
  expect(data, 'envelope.data shape').toBeTypeOf('object');
  return data!;
}

/** Assert the envelope's prompt + completion_event contract for a NON-terminal
 *  action. Per FR-7 prompt and completion_event live at the top level of
 *  `data` (alongside `action` and `context`). Anchors:
 *    - data.prompt is a non-empty string
 *    - data.completion_event === expectedEvent
 *    - data.prompt contains `Signal: ${expectedEvent}` (FR-23 — composed signal line) */
export function assertPromptForEvent(env: Envelope, expectedEvent: string): void {
  const data = getData(env);
  expect(data, 'data should carry prompt').toHaveProperty('prompt');
  expect(typeof data['prompt'], 'data.prompt typeof').toBe('string');
  expect((data['prompt'] as string).length, 'data.prompt.length').toBeGreaterThan(0);
  expect(data, 'data should carry completion_event').toHaveProperty('completion_event');
  expect(data['completion_event'], 'data.completion_event').toBe(expectedEvent);
  expect(data['prompt'] as string, 'data.prompt should contain Signal line').toContain(
    `Signal: ${expectedEvent}`,
  );
}

/** Assert the envelope's prompt + completion_event contract for a TERMINAL
 *  action (FR-5). Terminal actions have `data.completion_event: null` and the
 *  composed prompt must omit both the `## When complete` heading and the
 *  `Signal:` line. */
export function assertPromptForTerminalAction(env: Envelope): void {
  const data = getData(env);
  expect(data, 'data should carry prompt').toHaveProperty('prompt');
  expect(typeof data['prompt'], 'data.prompt typeof').toBe('string');
  expect((data['prompt'] as string).length, 'data.prompt.length').toBeGreaterThan(0);
  expect(data, 'data should carry completion_event').toHaveProperty('completion_event');
  expect(data['completion_event'], 'data.completion_event').toBeNull();
  expect(data['prompt'] as string, 'terminal prompt should omit ## When complete').not.toContain(
    '## When complete',
  );
  expect(data['prompt'] as string, 'terminal prompt should omit Signal:').not.toContain('Signal:');
}

/** Read the catalog's `action.<name>.md` frontmatter and return its
 *  `completion_event` value. Used by behavioral tests to ground prompt
 *  assertions in real catalog content (per the handoff: "next downstream
 *  action" rows read the resolved action's `completion_event` from the
 *  seeded catalog file rather than hard-coding it). */
export function catalogCompletionEvent(actionName: string): string | null {
  const file = path.join(realCatalogRoot(), `action.${actionName}.md`);
  const text = fs.readFileSync(file, 'utf8');
  // Minimal frontmatter parse — read the `completion_event:` line. The catalog
  // files follow a strict shape (validated elsewhere) so a substring extractor
  // is sufficient here and avoids pulling in a YAML parser at the assertion
  // surface.
  const match = /^completion_event:\s*(.+)$/m.exec(text);
  if (!match) throw new Error(`catalog file '${file}' has no completion_event line`);
  const raw = match[1]!.trim();
  if (raw === 'null') return null;
  return raw;
}

/** Branching helper: assert the envelope according to whether the action
 *  resolves to a terminal action (completion_event === null) or a
 *  non-terminal action (completion_event !== null). The action name is
 *  read directly from the envelope so the assertion stays honest against
 *  catalog drift in P04. */
export function assertPromptForEnvelopeAction(env: Envelope): void {
  const data = env.data as { action?: string | null } | undefined;
  const actionName = data?.action;
  expect(actionName, 'envelope.data.action').toBeDefined();
  if (actionName === null) {
    // No next action — context should be empty; nothing to assert here.
    return;
  }
  const completionEvent = catalogCompletionEvent(actionName as string);
  if (completionEvent === null) assertPromptForTerminalAction(env);
  else assertPromptForEvent(env, completionEvent);
}
