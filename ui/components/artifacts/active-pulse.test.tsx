import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActivePulse } from './active-pulse';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

test('frame variant renders a lavender frame pulse when active (DD-2, FR-6)', () => {
  const html = renderToStaticMarkup(createElement(ActivePulse, { active: true, variant: 'frame' }));
  assert.ok(html.includes('live-pulse-frame'), 'applies the frame-pulse class');
});

test('row variant is a contained background pulse with no border lines (DD-2)', () => {
  const html = renderToStaticMarkup(createElement(ActivePulse, { active: true, variant: 'row' }));
  assert.ok(html.includes('live-pulse-row'), 'applies the row-background pulse class');
  assert.ok(!html.includes('border'), 'row pulse adds no border lines');
});

test('inactive renders no pulse class — transient, never indefinite (FR-6)', () => {
  const html = renderToStaticMarkup(createElement(ActivePulse, { active: false, variant: 'frame' }));
  assert.ok(!html.includes('live-pulse-frame'));
});

test('reduced-motion block neutralizes the live pulse keyframes (NFR-10)', () => {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');
  const rm = css.slice(css.indexOf('prefers-reduced-motion'));
  assert.ok(rm.includes('live-pulse-frame'), 'frame pulse neutralized under reduced motion');
  assert.ok(rm.includes('live-pulse-row'), 'row pulse neutralized under reduced motion');
});
