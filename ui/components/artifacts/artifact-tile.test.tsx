import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArtifactTile } from './artifact-tile';
import type { Artifact } from '@/lib/artifact-model';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const wireframe: Artifact = {
  fileName: 'DEMO-WIREFRAME-LAUNCH-SCREEN.html',
  kind: 'wireframe', label: 'Wireframe', title: 'Launch Screen', isMarkdown: false,
};
const brainstorm: Artifact = {
  fileName: 'DEMO-BRAINSTORMING.md',
  kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true,
};

function render(props: Parameters<typeof ArtifactTile>[0]): string {
  return renderToStaticMarkup(createElement(ArtifactTile, props));
}
const noop = () => {};

test('renders friendly name and filename, no type badge (FR-5, DD-2)', () => {
  const html = render({ projectName: 'DEMO', artifact: wireframe, onOpen: noop, onDelete: noop });
  assert.ok(html.includes('Launch Screen'), 'friendly title rendered');
  assert.ok(html.includes('DEMO-WIREFRAME-LAUNCH-SCREEN.html'), 'filename rendered');
  assert.ok(!html.includes('Wireframe'), 'type badge label removed');
});

test('renders a live iframe preview for html artifacts (FR-5)', () => {
  const html = render({ projectName: 'DEMO', artifact: wireframe, onOpen: noop, onDelete: noop });
  assert.ok(html.includes('/api/projects/DEMO/raw?path=DEMO-WIREFRAME-LAUNCH-SCREEN.html'), 'iframe preview present');
});

test('markdown artifact uses the document-tile preview, not an iframe (FR-5)', () => {
  const html = render({ projectName: 'DEMO', artifact: brainstorm, onOpen: noop, onDelete: noop });
  assert.ok(!html.includes('/raw?path=DEMO-BRAINSTORMING.md'), 'md tile does not iframe markdown');
  assert.ok(html.includes('Brainstorm'), 'md tile labeled');
});

test('exposes a delete control on the tile (FR-6, DD-9)', () => {
  const html = render({ projectName: 'DEMO', artifact: wireframe, onOpen: noop, onDelete: noop });
  assert.ok(html.includes('aria-label="Delete artifact"'), 'delete control present');
});
