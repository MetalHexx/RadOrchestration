import fs from 'node:fs';
import path from 'node:path';
import { parseActionEventFile } from './action-event-loader.js';
import type { EventFrontmatter } from './action-event-loader.js';

export interface ComposeInput {
  actionName: string;
  completionEvent: string | null;
  catalogRoot: string;
  /** Optional in-memory overlay keyed by `<kind>.<name>.<slot>` (slot ∈ `pre` | `post`).
   *  A present key supersedes the on-disk custom file; an empty-string value suppresses the slot.
   *  When undefined the behavior is byte-identical to omitting the field (NFR-9).
   */
  overlay?: Record<string, string>;
}

// Fixed heading strings (DD-6).
const H_ACTION_PRE  = '## Before doing this action';
const H_EVENT_PRE   = '## Before signaling';
const H_WHEN_DONE   = '## When complete';
const H_EVENT_POST  = '## After signaling';

// Exported for engine.ts to reuse when prepending orphan-event-post content
// to the next action's composed prompt after an orphan signal resolves.
export const HEADING_AFTER_SIGNALING = H_EVENT_POST;

function readBodyIfExists(filePath: string, filename: string, kind: 'action' | 'event'): string | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseActionEventFile(text, filename);
  if (parsed.kind !== kind) {
    throw new Error(`Catalog file '${filePath}' parsed kind '${parsed.kind}' but kind '${kind}' expected.`);
  }
  return parsed.body;
}

function readEvent(filePath: string, filename: string): { body: string; fm: EventFrontmatter } | null {
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const parsed = parseActionEventFile(text, filename);
  if (parsed.kind !== 'event') {
    throw new Error(`Catalog file '${filePath}' expected to be an event but kind was '${parsed.kind}'.`);
  }
  return { body: parsed.body, fm: parsed.frontmatter as EventFrontmatter };
}

/**
 * Validates that when a custom slot file exists for the current envelope,
 * the referenced catalog file also exists (AD-7: scoped to envelope only).
 */
function validateCustomSlot(
  customFile: string,
  catalogFile: string,
  customFilename: string,
  catalogFilename: string,
  kind: 'action' | 'event',
  catalogRoot: string,
): void {
  if (fs.existsSync(customFile) && !fs.existsSync(catalogFile)) {
    throw new Error(
      `Composer validation: custom '${customFilename}' references unknown ${kind} — ` +
      `expected catalog file '${catalogFilename}' under '${catalogRoot}'.`,
    );
  }
}

function makeCustomReader(overlay: Record<string, string> | undefined) {
  return (filePath: string, overlayKey: string): string | null => {
    if (overlay && Object.prototype.hasOwnProperty.call(overlay, overlayKey)) {
      const v = overlay[overlayKey];
      return v === '' ? null : v;
    }
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf8');
  };
}

export function deriveSignalLine(eventName: string, fm: EventFrontmatter): string {
  const keys = Object.keys(fm.signal_payload ?? {});
  if (keys.length === 0) return `Signal: ${eventName}`;
  const flags = keys.map((k) => `--${k} <value>`).join(' ');
  return `Signal: ${eventName} ${flags}`;
}

function trimBody(s: string): string {
  // Strip leading and trailing blank lines while preserving inner whitespace.
  return s.replace(/^\s*\n+/, '').replace(/\n+\s*$/, '');
}

function appendSection(out: string[], heading: string | null, body: string | null): void {
  if (!body) return;
  const trimmed = trimBody(body);
  if (!trimmed) return;
  if (heading) out.push(heading);
  out.push(trimmed);
}

export function composeActionPrompt(input: ComposeInput): string {
  const { actionName, completionEvent, catalogRoot } = input;
  const customRoot = path.join(catalogRoot, 'custom');
  const sections: string[] = [];
  const readCustom = makeCustomReader(input.overlay);

  // Validate: action-pre custom implies action catalog must exist (AD-7).
  const actionCustomPre = path.join(customRoot, `action.${actionName}.pre.md`);
  const actionCatalog = path.join(catalogRoot, `action.${actionName}.md`);
  validateCustomSlot(
    actionCustomPre,
    actionCatalog,
    `custom/action.${actionName}.pre.md`,
    `action.${actionName}.md`,
    'action',
    catalogRoot,
  );

  // Slot 1: custom action pre
  appendSection(
    sections,
    H_ACTION_PRE,
    readCustom(actionCustomPre, `action.${actionName}.pre`),
  );

  // Main body (no heading — DD-7).
  const actionBody = readBodyIfExists(actionCatalog, `action.${actionName}.md`, 'action');
  if (actionBody === null) {
    throw new Error(
      `Composer validation: expected catalog file 'action.${actionName}.md' under '${catalogRoot}'.`,
    );
  }
  appendSection(sections, null, actionBody);

  // Event-driven sections only when completionEvent is non-null.
  if (completionEvent !== null) {
    // Validate: event-pre custom implies event catalog must exist (AD-7).
    const eventCustomPre = path.join(customRoot, `event.${completionEvent}.pre.md`);
    const eventCatalog = path.join(catalogRoot, `event.${completionEvent}.md`);
    const eventCustomPost = path.join(customRoot, `event.${completionEvent}.post.md`);
    validateCustomSlot(
      eventCustomPre,
      eventCatalog,
      `custom/event.${completionEvent}.pre.md`,
      `event.${completionEvent}.md`,
      'event',
      catalogRoot,
    );
    validateCustomSlot(
      eventCustomPost,
      eventCatalog,
      `custom/event.${completionEvent}.post.md`,
      `event.${completionEvent}.md`,
      'event',
      catalogRoot,
    );

    appendSection(
      sections,
      H_EVENT_PRE,
      readCustom(eventCustomPre, `event.${completionEvent}.pre`),
    );

    const evt = readEvent(eventCatalog, `event.${completionEvent}.md`);
    if (!evt) {
      throw new Error(
        `Composer validation: expected catalog file 'event.${completionEvent}.md' under '${catalogRoot}'.`,
      );
    }
    const whenCompleteBody = trimBody(evt.body) + '\n\n' + deriveSignalLine(completionEvent, evt.fm);
    appendSection(sections, H_WHEN_DONE, whenCompleteBody);

    appendSection(
      sections,
      H_EVENT_POST,
      readCustom(eventCustomPost, `event.${completionEvent}.post`),
    );
  }

  // DD-3: no leading blank, no double blank between sections. Join with one blank line.
  return sections.join('\n\n');
}

export interface OrphanComposeInput {
  eventName: string;
  catalogRoot: string;
  overlay?: Record<string, string>;
}

export function composeOrphanEventPrompt(input: OrphanComposeInput): string {
  const { eventName, catalogRoot, overlay } = input;
  const customRoot = path.join(catalogRoot, 'custom');
  const readCustom = makeCustomReader(overlay);
  const sections: string[] = [];

  const eventCatalog = path.join(catalogRoot, `event.${eventName}.md`);
  const eventCustomPre = path.join(customRoot, `event.${eventName}.pre.md`);
  const eventCustomPost = path.join(customRoot, `event.${eventName}.post.md`);

  validateCustomSlot(eventCustomPre, eventCatalog, `custom/event.${eventName}.pre.md`, `event.${eventName}.md`, 'event', catalogRoot);
  validateCustomSlot(eventCustomPost, eventCatalog, `custom/event.${eventName}.post.md`, `event.${eventName}.md`, 'event', catalogRoot);

  appendSection(sections, H_EVENT_PRE, readCustom(eventCustomPre, `event.${eventName}.pre`));

  const evt = readEvent(eventCatalog, `event.${eventName}.md`);
  if (!evt) {
    throw new Error(`Composer validation: expected catalog file 'event.${eventName}.md' under '${catalogRoot}'.`);
  }
  const whenCompleteBody = trimBody(evt.body) + '\n\n' + deriveSignalLine(eventName, evt.fm);
  appendSection(sections, H_WHEN_DONE, whenCompleteBody);

  appendSection(sections, H_EVENT_POST, readCustom(eventCustomPost, `event.${eventName}.post`));

  return sections.join('\n\n');
}
