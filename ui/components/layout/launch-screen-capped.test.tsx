import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LaunchScreen } from './launch-screen';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

function art(i: number) {
  return { fileName: `D-${i}.html`, kind: 'html' as const, label: 'Visual', title: null, isMarkdown: false };
}
const MANY = Array.from({ length: 24 }, (_, i) => art(i));

function render(artifacts: typeof MANY) {
  return renderToStaticMarkup(createElement(LaunchScreen, {
    projectName: 'DEMO', artifacts, onOpenArtifact: () => {}, onDeleteArtifact: () => {},
    onStartPlanning: () => {}, onStartBrainstorming: () => {}, pendingAction: null, errorMessage: null,
  } as never));
}

test('card is a bounded-height flex column, not vertically-centered auto-height (DD-9)', () => {
  const html = render(MANY);
  assert.ok(/max-h-|h-\[/.test(html), 'card has a bounded height');
  assert.ok(/flex-col/.test(html), 'card is a flex column');
  assert.ok(!/items-center justify-center/.test(html.slice(0, 400)), 'outer wrapper no longer vertically centers an auto-height card');
});

test('the tile region scrolls internally and signals more below (FR-15, DD-10)', () => {
  const html = render(MANY);
  assert.ok(/overflow-y-auto|overflow-auto/.test(html), 'tile region scrolls internally (reuses the global slim scrollbar)');
  assert.ok(/mask-image|to-transparent|from-/.test(html), 'a lower-edge fade signals more tiles below');
});

test('header and Start action are present and outside the scroll region (FR-15)', () => {
  const html = render(MANY);
  assert.ok(html.includes('DEMO'), 'pinned project-name header rendered');
  assert.ok(/Start Planning|Start Brainstorming/.test(html), 'pinned Start action rendered');
});
