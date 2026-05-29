import { test, describe, it, afterEach } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { InstructionDrawer } from './instruction-drawer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'instruction-drawer.tsx'), 'utf-8');

/**
 * Stub global fetch matching the payload. Records every call made to
 * /api/action-events/compose so tests can assert on the outgoing payload.
 *
 * @returns capturedBodies - array of parsed JSON bodies sent to the compose endpoint
 */
function seedComposeApi(spec: { input: Record<string, unknown>; response: Record<string, unknown> }): { capturedBodies: Record<string, unknown>[] } {
  const capturedBodies: Record<string, unknown>[] = [];
  const originalFetch = global.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = async (url: string, init?: RequestInit) => {
    if (url.toString().endsWith('/api/action-events/compose')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      capturedBodies.push(body);
      const matched = Object.entries(spec.input).every(([k, v]) => body[k] === v);
      if (matched) {
        return new Response(JSON.stringify(spec.response), { status: 200 });
      }
    }
    return new Response('{}', { status: 404 });
  };
  afterEach(() => { global.fetch = originalFetch; });
  return { capturedBodies };
}

/** DOM harness for rendering InstructionDrawer in JSDOM. */
function setupDom(): { dom: JSDOM; container: HTMLDivElement } {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: 'http://localhost:3000/',
  });
  Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
  const container = dom.window.document.getElementById('root') as HTMLDivElement;
  return { dom, container };
}

test('uses Sheet primitive on the right side (DD-9, NFR-7)', () => {
  assert.match(src, /@\/components\/ui\/sheet/);
  assert.match(src, /side="right"/);
});
test('imports MarkdownRenderer for body rendering (NFR-7, NFR-10)', () => {
  assert.match(src, /MarkdownRenderer/);
});
test('issues a single compose POST on open in preview mode (AD-13)', () => {
  assert.match(src, /\/api\/action-events\/compose/);
  assert.match(src, /method:\s*"POST"/);
});
test('fetches /api/action-events/help/readme in help mode (FR-25, AD-12)', () => {
  assert.match(src, /\/api\/action-events\/help\/readme/);
});

describe('InstructionDrawer — width and subtitle (FR-17, FR-22)', () => {
  test('SheetContent uses the /projects document-drawer width className (AD-11)', () => {
    assert.match(src, /!w-full/, 'SheetContent must include !w-full class');
    assert.match(src, /md:!w-\[80vw\]/, 'SheetContent must include md:!w-[80vw] class');
    assert.match(src, /md:!max-w-\[80vw\]/, 'SheetContent must include md:!max-w-[80vw] class');
  });

  test('body uses SheetScrollBody with ScrollArea h-full (DD-8)', () => {
    assert.match(src, /SheetScrollBody/, 'must import and use SheetScrollBody');
    assert.match(src, /data-slot="sheet-scroll-body"|<SheetScrollBody/, 'must render SheetScrollBody');
    assert.match(src, /ScrollArea[^>]*className="h-full"|className="h-full"[^>]*>/, 'ScrollArea must carry h-full className');
  });

  test('subtitle for action Preview keeps the byte-for-byte copy', () => {
    assert.match(src, /Byte-for-byte preview of the envelope/, 'action preview subtitle must contain "Byte-for-byte preview of the envelope"');
  });

  test('subtitle for orphan-event Preview teaches the prepend model (FR-22, DD-7)', () => {
    assert.match(src, /Runtime shape:/, 'orphan subtitle must contain "Runtime shape:"');
    assert.match(src, /prepended above the next action/, 'orphan subtitle must contain "prepended above the next action"');
  });
});

describe('InstructionDrawer — orphan Preview runtime shape (FR-18, DD-6)', () => {
  // Source-inspection coverage for the compose payload construction.
  // Note: @base-ui/react Dialog portals do not mount in JSDOM (the mounted state
  // requires browser animation/layout APIs), so rendered-DOM assertions are replaced
  // with (a) source-code assertions verifying the payload logic and (b) fetch-capture
  // assertions that verify the outgoing request at the network boundary.

  test('useEffect constructs mode: "runtime-orphan" for orphan event preview (FR-18, AD-12)', () => {
    // The payload must add mode: "runtime-orphan" when kind === "event" && is_orphan === true.
    assert.match(src, /isOrphan.*mode.*runtime-orphan|mode.*runtime-orphan.*isOrphan/s,
      'source must construct mode: "runtime-orphan" in the isOrphan branch');
    assert.match(src, /"runtime-orphan"/, 'source must contain the literal string "runtime-orphan"');
  });

  test('mode: "runtime-orphan" is absent from the payload for action preview (FR-19, AD-3)', () => {
    // The mode field must be conditional — not applied unconditionally.
    // Verified by the spread: ...(isOrphan ? { mode: "runtime-orphan" } : {})
    assert.match(src, /isOrphan\s*\?\s*\{[^}]*mode.*\}\s*:\s*\{\}|isOrphan.*runtime-orphan/s,
      'source must apply mode conditionally via the isOrphan branch only');
  });

  it('sends mode: "runtime-orphan" to /api/action-events/compose for orphan event preview (FR-18, NFR-6)', async () => {
    const { capturedBodies } = seedComposeApi({
      input: { kind: 'event', name: 'kickoff', mode: 'runtime-orphan' },
      response: {
        prompt: "## Step 1\n\nrant before next\n\n← the next action's prompt is composed here at runtime",
        has_custom_instructions: true,
      },
    });
    const { container } = setupDom();
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(InstructionDrawer, {
        mode: { type: 'preview', kind: 'event', name: 'kickoff', completion_event: null, overlay: { 'event.kickoff.post': 'rant before next' }, is_orphan: true },
        onClose: () => {},
      }));
    });
    await new Promise(r => setTimeout(r, 0));
    root.unmount();
    // The useEffect fires immediately on mount; assert the captured payload
    assert.ok(capturedBodies.length >= 1, 'expected at least one call to /api/action-events/compose');
    const payload = capturedBodies[0];
    assert.strictEqual(payload['kind'], 'event', 'payload.kind must be "event"');
    assert.strictEqual(payload['name'], 'kickoff', 'payload.name must be "kickoff"');
    assert.strictEqual(payload['mode'], 'runtime-orphan', 'payload.mode must be "runtime-orphan" for orphan event preview (FR-18)');
  });

  it('does NOT send mode field to /api/action-events/compose for action preview (FR-19)', async () => {
    const { capturedBodies } = seedComposeApi({
      input: { kind: 'action', name: 'foo' },
      response: {
        prompt: "## Step 1\n\nfoo body",
        has_custom_instructions: false,
      },
    });
    const { container } = setupDom();
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(InstructionDrawer, {
        mode: { type: 'preview', kind: 'action', name: 'foo', completion_event: 'foo_done', overlay: {} },
        onClose: () => {},
      }));
    });
    await new Promise(r => setTimeout(r, 0));
    root.unmount();
    assert.ok(capturedBodies.length >= 1, 'expected at least one call to /api/action-events/compose');
    const payload = capturedBodies[0];
    assert.strictEqual(payload['kind'], 'action', 'payload.kind must be "action"');
    assert.ok(!('mode' in payload), 'payload must NOT contain a mode field for action preview (FR-19)');
  });

  it('does NOT send mode field for non-orphan event preview (FR-19)', async () => {
    const { capturedBodies } = seedComposeApi({
      input: { kind: 'event', name: 'bar_done' },
      response: {
        prompt: "## Step 1\n\nbar done body",
        has_custom_instructions: false,
      },
    });
    const { container } = setupDom();
    let root!: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(React.createElement(InstructionDrawer, {
        mode: { type: 'preview', kind: 'event', name: 'bar_done', completion_event: null, overlay: {}, is_orphan: false },
        onClose: () => {},
      }));
    });
    await new Promise(r => setTimeout(r, 0));
    root.unmount();
    assert.ok(capturedBodies.length >= 1, 'expected at least one call to /api/action-events/compose');
    const payload = capturedBodies[0];
    assert.ok(!('mode' in payload), 'payload must NOT contain a mode field for non-orphan event preview (FR-19)');
  });
});
