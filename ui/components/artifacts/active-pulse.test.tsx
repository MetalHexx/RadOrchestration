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

test('inactive renders no pulse class — bounded by the JS hold (MIN_PULSE_MS), never indefinite (FR-6)', () => {
  // "Transient" now lives in the JS timer, not the CSS: the looping animation runs
  // only while `active` is true, and the provider clears `active` after MIN_PULSE_MS.
  const html = renderToStaticMarkup(createElement(ActivePulse, { active: false, variant: 'frame' }));
  assert.ok(!html.includes('live-pulse-frame'));
});

test('the live pulse loops (infinite) so a held or bursting change pulses continuously, not one flash (FR-6)', () => {
  // Regression guard for the "one missable flash" bug: a one-shot animation does not
  // replay while its class stays applied, so a held/burst change only flashed once.
  // Both pulse classes must loop. (Duration is intentionally not asserted — tunable.)
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');
  const base = css.slice(0, css.indexOf('prefers-reduced-motion'));
  assert.match(base, /live-pulse-frame-kf[^;]*infinite/, 'frame pulse animation loops');
  assert.match(base, /live-pulse-row-kf[^;]*infinite/, 'row pulse animation loops');
  assert.match(base, /live-pulse-stage-kf[^;]*infinite/, 'stage pulse loops');
});

test('reduced-motion shows a STATIC live tint (not invisible) so the change is still seen (NFR-10)', () => {
  const css = readFileSync(path.join(process.cwd(), 'app', 'globals.css'), 'utf-8');
  const rm = css.slice(css.indexOf('prefers-reduced-motion'));
  // Both pulse classes are still handled under reduced motion (animation killed)...
  assert.ok(rm.includes('live-pulse-frame'), 'frame pulse handled under reduced motion');
  assert.ok(rm.includes('live-pulse-row'), 'row pulse handled under reduced motion');
  // ...but instead of vanishing, each holds a static lavender indicator so the
  // change remains visible for the bounded hold.
  const frameRule = rm.slice(rm.indexOf('.live-pulse-frame'));
  assert.match(frameRule, /box-shadow:[^;]*var\(--live\)/, 'frame keeps a static live box-shadow');
  const rowRule = rm.slice(rm.indexOf('.live-pulse-row'));
  assert.match(rowRule, /background-color:[^;]*var\(--live\)/, 'row keeps a static live background tint');
  // Stage pulse: reduced-motion fallback keeps a static INSET lavender box-shadow.
  const stageRule = rm.slice(rm.indexOf('.live-pulse-stage'));
  assert.match(stageRule, /box-shadow:[^;]*inset[^;]*var\(--live\)/, 'stage keeps a static inset live box-shadow');
});
