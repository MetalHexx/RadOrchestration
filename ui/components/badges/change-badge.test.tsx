import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangeBadge } from './change-badge';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

test('renders icon-only, no visible label, colored by the live token (DD-3, FR-7)', () => {
  const html = renderToStaticMarkup(createElement(ChangeBadge));
  assert.ok(html.includes('var(--live)'), 'uses the live token color');
  assert.ok(html.includes('svg'), 'shows the single change symbol');
  assert.ok(!/>\s*Change\s*</.test(html), 'no visible "Change" label text');
});

test('pulses continuously while unseen (FR-7)', () => {
  const html = renderToStaticMarkup(createElement(ChangeBadge));
  assert.ok(html.includes('animate-pulse'), 'badge pulses while present');
});
