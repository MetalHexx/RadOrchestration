import fs from 'node:fs';
import path from 'node:path';
import { parseActionEventFile } from './action-event-loader.js';
import type { EventFrontmatter } from './action-event-loader.js';

export interface ComposeInput {
  actionName: string;
  completionEvent: string | null;
  catalogRoot: string;
}

// Fixed heading strings (DD-6).
const H_ACTION_PRE  = '## Before doing this action';
const H_EVENT_PRE   = '## Before signaling';
const H_WHEN_DONE   = '## When complete';
const H_EVENT_POST  = '## After signaling';

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

function readCustomBodyIfExists(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function deriveSignalLine(eventName: string, fm: EventFrontmatter): string {
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

  // Slot 1: custom action pre
  appendSection(
    sections,
    H_ACTION_PRE,
    readCustomBodyIfExists(path.join(customRoot, `action.${actionName}.pre.md`)),
  );

  // Main body (no heading — DD-7).
  const actionBody = readBodyIfExists(
    path.join(catalogRoot, `action.${actionName}.md`),
    `action.${actionName}.md`,
    'action',
  );
  if (actionBody === null) {
    throw new Error(`Composer: missing catalog file 'action.${actionName}.md' under '${catalogRoot}'.`);
  }
  appendSection(sections, null, actionBody);

  // Event-driven sections only when completionEvent is non-null.
  if (completionEvent !== null) {
    appendSection(
      sections,
      H_EVENT_PRE,
      readCustomBodyIfExists(path.join(customRoot, `event.${completionEvent}.pre.md`)),
    );

    const evt = readEvent(
      path.join(catalogRoot, `event.${completionEvent}.md`),
      `event.${completionEvent}.md`,
    );
    if (!evt) {
      throw new Error(`Composer: missing catalog file 'event.${completionEvent}.md' under '${catalogRoot}'.`);
    }
    const whenCompleteBody = trimBody(evt.body) + '\n\n' + deriveSignalLine(completionEvent, evt.fm);
    appendSection(sections, H_WHEN_DONE, whenCompleteBody);

    appendSection(
      sections,
      H_EVENT_POST,
      readCustomBodyIfExists(path.join(customRoot, `event.${completionEvent}.post.md`)),
    );
  }

  // DD-3: no leading blank, no double blank between sections. Join with one blank line.
  return sections.join('\n\n');
}
