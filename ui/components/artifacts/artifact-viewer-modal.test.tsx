import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtifactViewerModal } from './artifact-viewer-modal';
import type { Artifact } from '@/lib/artifact-model';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const arts: Artifact[] = [
  { fileName: 'DEMO-BRAINSTORMING.md', kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true },
  { fileName: 'DEMO-BRAINSTORM.html', kind: 'visual', label: 'Brainstorm Visual', title: null, isMarkdown: false },
  { fileName: 'DEMO-WIREFRAME-X.html', kind: 'wireframe', label: 'Wireframe', title: 'X', isMarkdown: false },
];
const noop = () => {};
function render(props: Parameters<typeof ArtifactViewerModal>[0]): string {
  return renderToStaticMarkup(createElement(ArtifactViewerModal, props));
}
const base = {
  projectName: 'DEMO', artifacts: arts, markdownContent: '# Hello',
  onClose: noop, onPrev: noop, onNext: noop, onSelect: noop, onRequestDelete: noop,
  isFullScreen: false, onToggleFullScreen: noop,
} as const;

test('renders the active html artifact in a sandboxed iframe on the stage (FR-13, NFR-1)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORM.html' });
  assert.ok(html.includes('/api/projects/DEMO/raw?path=DEMO-BRAINSTORM.html'), 'stage iframe targets raw route');
  assert.ok(!html.includes('allow-scripts'), 'stage iframe has no allow-scripts');
});

test('renders BRAINSTORMING.md via the markdown renderer, not an iframe (FR-13, AD-8)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md' });
  assert.ok(html.includes('Hello'), 'markdown content rendered on the stage');
  assert.ok(!html.includes('/raw?path=DEMO-BRAINSTORMING.md'), 'md is not iframed');
});

test('renders a filmstrip cell per artifact, all mounted (FR-18, NFR-4)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md' });
  const cells = (html.match(/data-filmstrip-cell/g) ?? []).length;
  assert.equal(cells, 3, 'one filmstrip cell per artifact');
});

test('renders nothing when the active filename is absent from the list (FR-19)', () => {
  assert.equal(render({ ...base, activeFileName: 'GONE.html' }), '');
  assert.equal(render({ ...base, activeFileName: null }), '');
});

test('exposes full-screen, delete, and close controls; omits new-tab/counter/legend (FR-15, FR-17, DD-7)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-WIREFRAME-X.html' });
  assert.ok(html.includes('aria-label="Full screen"'), 'full-screen control present');
  assert.ok(html.includes('aria-label="Delete artifact"'), 'delete control present');
  assert.ok(html.includes('aria-label="Close"'), 'close control present');
  assert.ok(!html.toLowerCase().includes('open in new tab'), 'no open-in-new-tab control');
  assert.ok(!/\b1\s*\/\s*3\b/.test(html), 'no position counter');
});

test('applies the full-screen layout class when isFullScreen is true (FR-17)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-WIREFRAME-X.html', isFullScreen: true });
  assert.ok(html.includes('w-screen'), 'full-screen panel spans the viewport width');
  assert.ok(html.includes('h-screen'), 'full-screen panel spans the viewport height');
});

test('uses the windowed layout (max-w-5xl, rounded-xl) when not full-screen (FR-17 morph target)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-WIREFRAME-X.html', isFullScreen: false });
  assert.ok(html.includes('max-w-5xl'), 'windowed panel is capped at max-w-5xl');
  assert.ok(html.includes('rounded-xl'), 'windowed panel has rounded corners');
});

test('renders the persistent active-document glow on the stage and the active filmstrip cell (Fix 5)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-WIREFRAME-X.html' });
  assert.ok(html.includes('active-doc-glow-stage'), 'stage carries the persistent glow overlay');
  assert.ok(html.includes('active-doc-glow-cell'), 'active filmstrip cell carries the persistent glow');
});

test('renders a label caption for every filmstrip cell (DD-8)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md' });
  assert.ok(html.includes('Brainstorm Visual'), 'filmstrip shows friendly name for second artifact');
  // The third artifact has title 'X', so the caption renders the friendly name 'X', not 'Wireframe'
  assert.ok(html.includes('X'), 'filmstrip shows friendly name for third artifact');
  // All three captions must appear; with the md active, 'Brainstorm' is in the header friendly span
  // AND must appear as a filmstrip caption too
  const brainstormCount = (html.match(/Brainstorm/g) ?? []).length;
  assert.ok(brainstormCount >= 2, 'Brainstorm label appears in both header and filmstrip');
});

test('makes every filmstrip cell a keyboard-accessible button (Issue A)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md' });
  const roleButtons = (html.match(/role="button"/g) ?? []).length;
  assert.ok(roleButtons >= 3, 'at least one role="button" per filmstrip cell');
  const tabbables = (html.match(/tabindex="0"/g) ?? []).length;
  assert.ok(tabbables >= 3, 'at least one tabindex="0" per filmstrip cell');
});

test('marks exactly one filmstrip cell as the current artifact (Issue A)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md' });
  const current = (html.match(/aria-current="true"/g) ?? []).length;
  assert.equal(current, 1, 'exactly one cell carries aria-current="true"');
});

test('aria-current tracks the active filename, not a fixed array slot, after a reorder (regression)', () => {
  // The user is focused on the html visual. Render once in the original order…
  const before = render({ ...base, activeFileName: 'DEMO-BRAINSTORM.html' });
  // …then with the array reordered underneath the modal. The aria-current cell
  // must still be the SAME document (the one whose label is its own), never the
  // file that happens to sit at the old index.
  const reordered: Artifact[] = [arts[2], arts[1], arts[0]];
  const after = render({ ...base, artifacts: reordered, activeFileName: 'DEMO-BRAINSTORM.html' });
  // Exactly one current cell in each render.
  assert.equal((before.match(/aria-current="true"/g) ?? []).length, 1);
  assert.equal((after.match(/aria-current="true"/g) ?? []).length, 1);
  // The dialog still identifies the active doc by its own filename in both.
  assert.ok(before.includes('DEMO-BRAINSTORM.html'));
  assert.ok(after.includes('DEMO-BRAINSTORM.html'));
  // The aria-current cell carries the active file's own label ("Brainstorm Visual"),
  // proving the highlight follows the filename through the reorder.
  for (const html of [before, after]) {
    const m = html.match(/aria-current="true"[^>]*aria-label="View ([^"]+)"|aria-label="View ([^"]+)"[^>]*aria-current="true"/);
    assert.ok(m, 'current cell exposes its view label');
    assert.equal(m![1] ?? m![2], 'Brainstorm Visual', 'highlight stays on the active document');
  }
});

test('resolves the active document by filename, not by array slot (regression)', () => {
  // Same artifacts, two different orderings. The active filename points at the
  // wireframe, which sits at a DIFFERENT index in each list. The stage must show
  // it regardless of where it landed — proving identity is the filename.
  const orderA: Artifact[] = [arts[0], arts[1], arts[2]]; // wireframe at index 2
  const orderB: Artifact[] = [arts[2], arts[0], arts[1]]; // wireframe at index 0
  const a = render({ ...base, artifacts: orderA, activeFileName: 'DEMO-WIREFRAME-X.html' });
  const b = render({ ...base, artifacts: orderB, activeFileName: 'DEMO-WIREFRAME-X.html' });
  for (const html of [a, b]) {
    assert.ok(html.includes('/api/projects/DEMO/raw?path=DEMO-WIREFRAME-X.html'), 'stage shows the file named by activeFileName');
  }
});

test('applies cursor-pointer to clickable controls (Issue A/C)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORM.html' });
  assert.ok(html.includes('cursor-pointer'), 'cursor-pointer present in modal markup');
});

test('shows a loading spinner while markdown content is unresolved (Extras)', () => {
  const html = render({ ...base, activeFileName: 'DEMO-BRAINSTORMING.md', markdownContent: null });
  assert.ok(html.includes('role="status"'), 'markdown loading spinner present');
  assert.ok(html.includes('aria-label="Loading document"'), 'spinner is labelled');
});
