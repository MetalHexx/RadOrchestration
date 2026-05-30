import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IframePreview, computeFitScale } from './iframe-preview';
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

test('computeFitScale scales down to fit a narrower container (FR-16)', () => {
  const scale = computeFitScale(900, 1280);
  assert.ok(Math.abs(scale - 900 / 1280) < 1e-9, 'scale equals containerWidth/designWidth');
  assert.ok(Math.abs(scale - 0.703125) < 1e-6, 'scale ≈ 0.703125');
});

test('computeFitScale never upscales when container is wider than design (FR-16)', () => {
  assert.equal(computeFitScale(1600, 1280), 1, 'wider container clamps to 1');
});

test('computeFitScale returns 1 when container equals design width (FR-16)', () => {
  assert.equal(computeFitScale(1280, 1280), 1, 'equal widths produce scale 1');
});

test('computeFitScale guards against a zero container width (FR-16)', () => {
  assert.equal(computeFitScale(0, 1280), 1, 'zero container width returns 1');
});

test('computeFitScale guards against a zero design width (FR-16)', () => {
  assert.equal(computeFitScale(900, 0), 1, 'zero design width returns 1');
});

test('renders loading="lazy" by default (Issue B)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html' });
  assert.ok(html.includes('loading="lazy"'), 'iframe lazy-loads by default');
});

test('renders loading="eager" when eager is passed (Issue B)', () => {
  const html = render({ projectName: 'DEMO', fileName: 'DEMO-BRAINSTORM.html', eager: true });
  assert.ok(html.includes('loading="eager"'), 'iframe eagerly loads when eager');
});
