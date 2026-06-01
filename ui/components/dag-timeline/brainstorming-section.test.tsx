import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrainstormingSection } from './brainstorming-section';
import type { Artifact } from '@/lib/artifact-model';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const arts: Artifact[] = [
  { fileName: 'DEMO-BRAINSTORMING.md', kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true },
  { fileName: 'DEMO-WIREFRAME-DAG-VIEW.html', kind: 'wireframe', label: 'Wireframe', title: 'Dag View', isMarkdown: false },
];
const noop = () => {};
function render(props: Parameters<typeof BrainstormingSection>[0]): string {
  return renderToStaticMarkup(createElement(BrainstormingSection, props));
}

test('renders the uppercase Brainstorming label with no count badge (FR-9, DD-4)', () => {
  const html = render({ artifacts: arts, onOpen: noop, onDelete: noop });
  assert.ok(html.toLowerCase().includes('brainstorming'), 'section label present');
  assert.ok(!/Brainstorming\s*\(?\d/.test(html), 'no count badge on the label');
});

test('renders one row per artifact with friendly name and filename (FR-10)', () => {
  const html = render({ artifacts: arts, onOpen: noop, onDelete: noop });
  assert.ok(html.includes('Dag View'), 'wireframe friendly title rendered');
  assert.ok(html.includes('DEMO-WIREFRAME-DAG-VIEW.html'), 'filename rendered');
  assert.ok(html.includes('Brainstorm'), 'markdown row friendly name rendered');
});

test('each row exposes a delete control (FR-11, DD-9)', () => {
  const html = render({ artifacts: arts, onOpen: noop, onDelete: noop });
  const count = (html.match(/aria-label="Delete artifact"/g) ?? []).length;
  assert.equal(count, 2, 'one delete control per row');
});

test('open + delete controls are real <button> elements, not nested role="button" spans', () => {
  const html = render({ artifacts: arts, onOpen: noop, onDelete: noop });
  // The delete affordance must be a real <button> (no synthetic role="button"
  // nested inside an interactive row — invalid HTML/ARIA).
  const deleteButtons = (html.match(/<button[^>]*aria-label="Delete artifact"/g) ?? []).length;
  assert.equal(deleteButtons, 2, 'delete control is a real <button> per row');
  assert.ok(!html.includes('role="button"'), 'no synthetic role="button" controls remain');
});

test('renders nothing when there are no artifacts (FR-9)', () => {
  const html = render({ artifacts: [], onOpen: noop, onDelete: noop });
  assert.equal(html, '');
});

test('an unseen row swaps the leading type icon for the single lavender change badge (FR-7, DD-3)', () => {
  const html = render({
    artifacts: [arts[1]], onOpen: noop, onDelete: noop,
    unseen: new Set(['DEMO-WIREFRAME-DAG-VIEW.html']),
  });
  // The lavender change badge is present in the leading slot...
  assert.ok(html.includes('aria-label="Unseen change"'), 'change badge present on the unseen row');
  assert.ok(html.includes('var(--live)'), 'lavender live token used');
  // ...and it REPLACED the blue type icon rather than appearing alongside it:
  // exactly one badge, no --tier-planning type badge on the row.
  assert.ok(!html.includes('var(--tier-planning)'), 'blue type icon is swapped out, not shown alongside (single badge)');
  const changeBadges = (html.match(/aria-label="Unseen change"/g) ?? []).length;
  assert.equal(changeBadges, 1, 'exactly one change badge on the unseen row');
});

test('a seen row keeps the blue type icon and shows no change badge (DD-4, FR-8)', () => {
  const html = render({
    artifacts: [arts[1]], onOpen: noop, onDelete: noop,
    unseen: new Set(),
  });
  assert.ok(html.includes('var(--tier-planning)'), 'blue type icon present when seen');
  assert.ok(!html.includes('aria-label="Unseen change"'), 'no change badge once seen');
});
