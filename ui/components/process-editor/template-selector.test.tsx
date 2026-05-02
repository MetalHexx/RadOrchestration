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
let initialUrl = '/process-editor';

function setupDom(url: string): void {
  initialUrl = url;
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

/** Render the selector with a stub `onTemplateChange` and `routerReplace` so we can observe URL writes. */
async function render(initial: string, params: { onTemplateChange?: (id: string) => void } = {}): Promise<void> {
  setupDom(initial);
  await act(async () => {
    root = createRoot(container);
    root.render(
      React.createElement(TemplateSelector, {
        initialTemplateId: new URL(`http://localhost:3000${initial}`).searchParams.get('template') ?? '',
        onTemplateChange: params.onTemplateChange ?? (() => undefined),
        routerReplace: (href: string) => { lastReplaceUrl = href; },
      }),
    );
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
    await render('/process-editor?template=quick', { onTemplateChange: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'quick');
    assert.equal(observed, 'quick');
  });

  it('falls back to default when ?template is absent', async () => {
    let observed = '';
    await render('/process-editor', { onTemplateChange: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'default');
    assert.equal(observed, 'default');
  });

  it('falls back to default silently when ?template names an unknown id', async () => {
    let observed = '';
    await render('/process-editor?template=nonexistent', { onTemplateChange: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const errEl = container.querySelector('[role="alert"]');
    assert.equal(errEl, null, 'no error toast or banner for unknown ?template');
    assert.equal(observed, 'default');
  });

  it('shows a deprecated template that arrives via direct URL but does not add it to the dropdown options list', async () => {
    let observed = '';
    await render('/process-editor?template=old', { onTemplateChange: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    assert.equal(select.value, 'old');
    assert.equal(observed, 'old');
  });

  it('on change, calls routerReplace with ?template=<id> and notifies via onTemplateChange', async () => {
    let observed = '';
    await render('/process-editor', { onTemplateChange: id => { observed = id; } });
    await new Promise(r => setTimeout(r, 0));
    const select = container.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      select.value = 'quick';
      select.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
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
});
