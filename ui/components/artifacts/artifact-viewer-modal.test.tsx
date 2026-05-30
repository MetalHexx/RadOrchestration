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
  const html = render({ ...base, activeIndex: 1 });
  assert.ok(html.includes('/api/projects/DEMO/raw?path=DEMO-BRAINSTORM.html'), 'stage iframe targets raw route');
  assert.ok(!html.includes('allow-scripts'), 'stage iframe has no allow-scripts');
});

test('renders BRAINSTORMING.md via the markdown renderer, not an iframe (FR-13, AD-8)', () => {
  const html = render({ ...base, activeIndex: 0 });
  assert.ok(html.includes('Hello'), 'markdown content rendered on the stage');
  assert.ok(!html.includes('/raw?path=DEMO-BRAINSTORMING.md'), 'md is not iframed');
});

test('renders a filmstrip cell per artifact, all mounted (FR-18, NFR-4)', () => {
  const html = render({ ...base, activeIndex: 0 });
  const cells = (html.match(/data-filmstrip-cell/g) ?? []).length;
  assert.equal(cells, 3, 'one filmstrip cell per artifact');
});

test('exposes full-screen, delete, and close controls; omits new-tab/counter/legend (FR-15, FR-17, DD-7)', () => {
  const html = render({ ...base, activeIndex: 2 });
  assert.ok(html.includes('aria-label="Full screen"'), 'full-screen control present');
  assert.ok(html.includes('aria-label="Delete artifact"'), 'delete control present');
  assert.ok(html.includes('aria-label="Close"'), 'close control present');
  assert.ok(!html.toLowerCase().includes('open in new tab'), 'no open-in-new-tab control');
  assert.ok(!/\b1\s*\/\s*3\b/.test(html), 'no position counter');
});

test('applies the full-screen layout class when isFullScreen is true (FR-17)', () => {
  const html = render({ ...base, activeIndex: 2, isFullScreen: true });
  assert.ok(html.includes('inset-0'), 'full-screen occupies the whole screen');
});

test('renders a label caption for every filmstrip cell (DD-8)', () => {
  const html = render({ ...base, activeIndex: 0 });
  assert.ok(html.includes('Brainstorm Visual'), 'filmstrip shows label for second artifact');
  assert.ok(html.includes('Wireframe'), 'filmstrip shows label for third artifact');
  // All three labels must appear; with activeIndex=0, 'Brainstorm' is in the header badge
  // AND must appear as a filmstrip caption too
  const brainstormCount = (html.match(/Brainstorm/g) ?? []).length;
  assert.ok(brainstormCount >= 2, 'Brainstorm label appears in both header and filmstrip');
});

test('makes every filmstrip cell a keyboard-accessible button (Issue A)', () => {
  const html = render({ ...base, activeIndex: 0 });
  const roleButtons = (html.match(/role="button"/g) ?? []).length;
  assert.ok(roleButtons >= 3, 'at least one role="button" per filmstrip cell');
  const tabbables = (html.match(/tabindex="0"/g) ?? []).length;
  assert.ok(tabbables >= 3, 'at least one tabindex="0" per filmstrip cell');
});

test('marks exactly one filmstrip cell as the current artifact (Issue A)', () => {
  const html = render({ ...base, activeIndex: 0 });
  const current = (html.match(/aria-current="true"/g) ?? []).length;
  assert.equal(current, 1, 'exactly one cell carries aria-current="true"');
});

test('applies cursor-pointer to clickable controls (Issue A/C)', () => {
  const html = render({ ...base, activeIndex: 1 });
  assert.ok(html.includes('cursor-pointer'), 'cursor-pointer present in modal markup');
});

test('shows a loading spinner while markdown content is unresolved (Extras)', () => {
  const html = render({ ...base, activeIndex: 0, markdownContent: null });
  assert.ok(html.includes('role="status"'), 'markdown loading spinner present');
  assert.ok(html.includes('aria-label="Loading document"'), 'spinner is labelled');
});
