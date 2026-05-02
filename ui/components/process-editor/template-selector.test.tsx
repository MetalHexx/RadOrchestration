import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { TemplateSelector } from './template-selector';

// react-dom (CJS) expects React on globalThis; react act() requires the env flag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let dom: JSDOM;
let container: HTMLDivElement;
let root: Root;
let fetchCalls: string[] = [];
let lastReplaceUrl: string | null = null;
let resolvedHistory: string[] = [];

function setupDom(url: string): void {
  dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: `http://localhost:3000${url}`,
  });
  // Use defineProperty for globals that Node.js v18+ exposes as getter-only
  // (window, document, navigator). Direct assignment throws TypeError in strict mode.
  Object.defineProperty(globalThis, 'window', { value: dom.window, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: dom.window.document, writable: true, configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
  lastReplaceUrl = null;
  fetchCalls = [];
  resolvedHistory = [];
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (url: string) => {
    fetchCalls.push(url);
    return new Response(JSON.stringify({
      templates: [
        { id: 'default', description: 'Canonical', version: '1.0.0' },
        { id: 'quick', description: 'Quick mode', version: '1.0.0' },
        { id: 'old', description: 'Old', version: '0.1', status: 'deprecated' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  container = dom.window.document.getElementById('root') as HTMLDivElement;
}

function teardownDom(): void {
  try { root.unmount(); } catch { /* noop */ }
  dom.window.close();
}

/**
 * Test harness component. Mirrors the page's behavior: holds `requestedTemplateId`
 * in state and updates it whenever `routerReplace` is called, simulating Next.js
 * useSearchParams + router.replace re-rendering the parent. Exposes the
 * `onResolved` callback so tests can observe resolution events.
 */
interface HarnessProps {
  initialRequested: string;
  onResolved?: (id: string) => void;
}

function Harness({ initialRequested, onResolved }: HarnessProps): JSX.Element {
  const [requested, setRequested] = React.useState(initialRequested);
  return React.createElement(TemplateSelector, {
    requestedTemplateId: requested,
    onResolved: (id: string) => {
      resolvedHistory.push(id);
      onResolved?.(id);
    },
    routerReplace: (href: string) => {
      lastReplaceUrl = href;
      // Simulate Next.js useSearchParams re-firing: pull ?template out of href
      // and feed it back as the parent's `requestedTemplateId` prop.
      const next = new URL(href, 'http://localhost:3000').searchParams.get('template') ?? '';
      setRequested(next);
    },
  });
}

/** Programmatic ref to the harness so a test can drive `setRequested` from outside (back/forward sim). */
interface HarnessHandle { setRequested: (id: string) => void }

const HarnessWithRef = React.forwardRef<HarnessHandle, HarnessProps>(
  function HarnessWithRef({ initialRequested, onResolved }, ref) {
    const [requested, setRequested] = React.useState(initialRequested);
    React.useImperativeHandle(ref, () => ({ setRequested }), []);
    return React.createElement(TemplateSelector, {
      requestedTemplateId: requested,
      onResolved: (id: string) => {
        resolvedHistory.push(id);
        onResolved?.(id);
      },
      routerReplace: (href: string) => {
        lastReplaceUrl = href;
        const next = new URL(href, 'http://localhost:3000').searchParams.get('template') ?? '';
        setRequested(next);
      },
    });
  },
);

async function render(initial: string, params: { onResolved?: (id: string) => void } = {}): Promise<void> {
  setupDom(initial);
  const initialRequested = new URL(`http://localhost:3000${initial}`).searchParams.get('template') ?? '';
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(Harness, { initialRequested, onResolved: params.onResolved }));
  });
}

async function renderWithRef(
  initial: string,
  ref: React.RefObject<HarnessHandle>,
  params: { onResolved?: (id: string) => void } = {},
): Promise<void> {
  setupDom(initial);
  const initialRequested = new URL(`http://localhost:3000${initial}`).searchParams.get('template') ?? '';
  await act(async () => {
    root = createRoot(container);
    root.render(React.createElement(HarnessWithRef, { initialRequested, onResolved: params.onResolved, ref }));
  });
}

describe('TemplateSelector', () => {
  afterEach(() => teardownDom());

  it('fetches /api/templates on mount and renders non-deprecated options', async () => {
    await render('/process-editor');
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(fetchCalls, ['/api/templates']);
    const opts = Array.from(container.querySelectorAll('option')).map(o => o.value);
    assert.ok(opts.includes('default'));
    assert.ok(opts.includes('quick'));
    assert.ok(!opts.includes('old'), 'deprecated template "old" must not appear in dropdown');
  });

  it('uses ?template from URL as the initial active id', async () => {
    let observed = '';
    await render('/process-editor?template=quick', { onResolved: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'quick');
    assert.equal(observed, 'quick');
  });

  it('falls back to default when ?template is absent', async () => {
    let observed = '';
    await render('/process-editor', { onResolved: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'default');
    assert.equal(observed, 'default');
  });

  it('falls back to default silently when ?template names an unknown id', async () => {
    let observed = '';
    await render('/process-editor?template=nonexistent', { onResolved: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const errEl = container.querySelector('[role="alert"]');
    assert.equal(errEl, null, 'no error toast or banner for unknown ?template');
    assert.equal(observed, 'default');
  });

  it('never resolves to an unknown id even transiently (no canvas-error flash for ?template=nonexistent)', async () => {
    // F-R1-1 symptom 2: with the old implementation the parent seeded
    // activeTemplateId='nonexistent' before the templates fetch resolved, causing
    // ReadOnlyCanvas to fetch /api/templates/nonexistent → 404 → red error span
    // until the selector finished loading. The fix is for the parent to gate
    // canvas rendering on a non-empty resolved id, and for the selector to never
    // hand 'nonexistent' to onResolved.
    await render('/process-editor?template=nonexistent');
    await new Promise(r => setTimeout(r, 0));
    assert.ok(
      !resolvedHistory.includes('nonexistent'),
      `onResolved must never receive 'nonexistent'; got history ${JSON.stringify(resolvedHistory)}`,
    );
    assert.deepEqual(resolvedHistory, ['default']);
  });

  it('reflects a requestedTemplateId prop change after mount (back/forward navigation)', async () => {
    // F-R1-1 symptom 1: the prior implementation seeded activeTemplateId via
    // useState(initialTemplateId || 'default'), so a later prop change from
    // useSearchParams was ignored. The fix is to derive the requested id from
    // the URL on every render and let the selector recompute resolved.
    const ref = React.createRef<HarnessHandle>();
    await renderWithRef('/process-editor?template=quick', ref);
    await new Promise(r => setTimeout(r, 0));
    let select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'quick');
    assert.equal(resolvedHistory.at(-1), 'quick');

    await act(async () => {
      ref.current!.setRequested('default');
    });
    await new Promise(r => setTimeout(r, 0));
    select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'default', 'select.value must follow the new requested id');
    assert.equal(resolvedHistory.at(-1), 'default', 'onResolved must fire for the new resolved id');
  });

  it('shows a deprecated template that arrives via direct URL but does not add it to the dropdown options list', async () => {
    let observed = '';
    await render('/process-editor?template=old', { onResolved: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    // F-R1-7: assert the option list shape, not just select.value. In jsdom a
    // controlled <select> writes its value directly regardless of whether a
    // matching <option> exists, so checking select.value alone can't catch a
    // broken showActiveAsExtra. Real browsers require a matching option.
    const opts = Array.from(container.querySelectorAll('option')).map(o => o.value);
    assert.ok(opts.includes('default'));
    assert.ok(opts.includes('quick'));
    assert.ok(opts.includes('old'), 'deprecated active id must appear as extra option');
    assert.equal(opts.length, 3, 'exactly default, quick, old when deprecated id is active');
    assert.equal(select.value, 'old');
    assert.equal(observed, 'old');
  });

  it('on change, calls routerReplace with ?template=<id> and notifies via onResolved', async () => {
    let observed = '';
    await render('/process-editor', { onResolved: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'quick';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    // Harness routerReplace updates the simulated URL and re-renders, which
    // triggers a fresh resolution and an onResolved('quick') call.
    await new Promise(r => setTimeout(r, 0));
    assert.equal(observed, 'quick');
    assert.ok(lastReplaceUrl && lastReplaceUrl.includes('template=quick'), `expected URL to contain template=quick, got ${lastReplaceUrl}`);
  });

  it('renders a visible label "Template" associated with the select', async () => {
    await render('/process-editor');
    await new Promise(r => setTimeout(r, 0));
    const label = container.querySelector('label');
    assert.ok(label && /Template/i.test(label.textContent ?? ''));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.ok(select.id && label!.getAttribute('for') === select.id);
  });

  it('contains fetch rejection: surfaces an alert, falls back to default, and emits no unhandled rejection', async () => {
    // F-R2-2: the load() effect previously had only try/finally, so a rejected
    // fetch (network error) escaped as an unhandledrejection. The fix adds a
    // catch that records the error and renders <span role="alert">.
    //
    // Test posture: install a process-level unhandledRejection listener that
    // counts events, then render with a rejecting fetch. Assert alert visible,
    // onResolved fired with 'default' (silent fallback), and counter still 0.
    setupDom('/process-editor');
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;

    let unhandledCount = 0;
    const listener = (): void => { unhandledCount += 1; };
    process.on('unhandledRejection', listener);
    try {
      let observed = '';
      await act(async () => {
        root = createRoot(container);
        root.render(
          React.createElement(Harness, {
            initialRequested: '',
            onResolved: (id: string) => { observed = id; },
          }),
        );
      });
      // Yield enough microtask + macrotask turns for the fetch rejection,
      // catch, setState batch, and the rerender to flush. Same pattern as
      // the other tests in this file, which also flush via setTimeout(0).
      await new Promise(r => setTimeout(r, 0));
      await new Promise(r => setTimeout(r, 0));

      const errEl = container.querySelector('[role="alert"]');
      assert.ok(errEl, 'alert element must be present after fetch rejection');
      assert.match(errEl!.textContent ?? '', /Failed to load templates/);
      assert.equal(observed, 'default', 'onResolved must fall back to default on fetch error');
      assert.equal(unhandledCount, 0, 'no unhandledRejection event should fire');

      // F-R3-2: even with templates=[] the dropdown must render the resolved id as
      // a fallback option and disable interaction so the user is not left with a
      // blank-but-enabled <select> while the canvas silently shows 'default'.
      const select = container.querySelector('select') as HTMLSelectElement;
      assert.equal(select.value, 'default', 'select must reflect the resolved fallback id');
      assert.equal(select.disabled, true, 'select must be disabled when fetch failed');
      const opts = Array.from(container.querySelectorAll('option')).map(o => o.value);
      assert.ok(opts.includes('default'), 'default option must be present so select is not blank');
    } finally {
      process.off('unhandledRejection', listener);
    }
  });
});
