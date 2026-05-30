import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IframePreview } from './iframe-preview';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

function render(props: Parameters<typeof IframePreview>[0]): string {
  return renderToStaticMarkup(createElement(IframePreview, props));
}

test('points the iframe src at the raw route with encoded project + path (AD-5, FR-13)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html' });
  assert.ok(html.includes('/api/projects/DEMO/raw?path=DEMO-BRAINSTORM.html'), 'src targets raw route');
});

test('renders a sandboxed iframe without allow-scripts (NFR-1)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html' });
  assert.ok(html.includes('sandbox='), 'iframe carries a sandbox attribute');
  assert.ok(!html.includes('allow-scripts'), 'sandbox must not allow scripts');
});

test('applies a CSS scale transform when scale prop is given (FR-16)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html', scale: 0.25 });
  assert.ok(html.includes('scale(0.25)'), 'scale transform applied');
});

test('disables pointer events on the iframe when interactive is false (FR-18)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html', scale: 0.1, interactive: false });
  assert.ok(html.includes('pointer-events:none') || html.includes('pointer-events: none'), 'pointer events disabled');
});
