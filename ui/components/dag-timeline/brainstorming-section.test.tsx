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
  const html = render({ projectName: 'DEMO', artifacts: arts, onOpen: noop, onDelete: noop });
  assert.ok(html.toLowerCase().includes('brainstorming'), 'section label present');
  assert.ok(!/Brainstorming\s*\(?\d/.test(html), 'no count badge on the label');
});

test('renders one row per artifact with friendly name and filename (FR-10)', () => {
  const html = render({ projectName: 'DEMO', artifacts: arts, onOpen: noop, onDelete: noop });
  assert.ok(html.includes('Dag View'), 'wireframe friendly title rendered');
  assert.ok(html.includes('DEMO-WIREFRAME-DAG-VIEW.html'), 'filename rendered');
  assert.ok(html.includes('Brainstorm'), 'markdown row friendly name rendered');
});

test('each row exposes a delete control (FR-11, DD-9)', () => {
  const html = render({ projectName: 'DEMO', artifacts: arts, onOpen: noop, onDelete: noop });
  const count = (html.match(/aria-label="Delete artifact"/g) ?? []).length;
  assert.equal(count, 2, 'one delete control per row');
});

test('renders nothing when there are no artifacts (FR-9)', () => {
  const html = render({ projectName: 'DEMO', artifacts: [], onOpen: noop, onDelete: noop });
  assert.equal(html, '');
});
