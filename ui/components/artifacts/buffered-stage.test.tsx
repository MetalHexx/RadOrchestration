import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BufferedStage, MarkdownLayer } from './buffered-stage';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const MD = { fileName: 'A.md', kind: 'markdown' as const, label: 'Doc', title: null, isMarkdown: true };

test('stage uses a dark backstop, not a white background (DD-8)', () => {
  const html = renderToStaticMarkup(createElement(BufferedStage, {
    projectName: 'DEMO', artifact: MD, markdownContent: '# Hi', activePulse: false,
  } as never));
  assert.ok(!/bg-white/.test(html), 'white iframe background dropped');
  assert.ok(/bg-background|bg-card|bg-muted/.test(html), 'dark app surface used as backstop');
});

test('two stacked layers exist for double-buffering (DD-7, FR-16)', () => {
  const html = renderToStaticMarkup(createElement(BufferedStage, {
    projectName: 'DEMO', artifact: MD, markdownContent: '# Hi', activePulse: false,
  } as never));
  const layers = html.match(/data-stage-layer/g) ?? [];
  assert.ok(layers.length >= 2, 'two stage layers for buffered cross-fade');
});

test('the dark backstop carries no onLoad — readiness is per layer (DD-7)', () => {
  const html = renderToStaticMarkup(createElement(BufferedStage, {
    projectName: 'DEMO', artifact: MD, markdownContent: '# Hi', activePulse: false,
  } as never));
  // A wrapper <div onLoad> would never fire for the markdown layer, so the
  // ready trigger must not live on the backstop wrapper.
  assert.ok(!/onload/i.test(html), 'no wrapper onLoad drives readiness');
});

test('the markdown layer reports ready via a committed-body layout effect, not <div onLoad> (DD-7, FR-16)', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const { window } = dom;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document = window.document;
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const scrollRef = React.createRef<HTMLDivElement>();
  let readyCount = 0;
  const root = createRoot(window.document.getElementById('root')!);
  await act(async () => {
    root.render(createElement(MarkdownLayer, {
      content: '# Hi', scrollRef, onReady: () => { readyCount += 1; },
    } as never));
  });
  assert.equal(readyCount, 1, 'markdown layer fired its own ready signal once the body committed');
  const container = window.document.getElementById('root')!;
  assert.ok(!/onload/i.test(container.innerHTML), 'markdown layer attaches no onLoad handler in its DOM');
  await act(async () => { root.unmount(); });
});

test('html iframes stay sandboxed without allow-scripts (NFR-8)', () => {
  const htmlArt = { fileName: 'V.html', kind: 'html' as const, label: 'Visual', title: null, isMarkdown: false };
  const html = renderToStaticMarkup(createElement(BufferedStage, {
    projectName: 'DEMO', artifact: htmlArt, markdownContent: null, activePulse: false,
  } as never));
  assert.ok(/sandbox="allow-same-origin"/.test(html), 'iframe sandboxed, same-origin only');
  assert.ok(!/allow-scripts/.test(html), 'no script execution in the artifact iframe');
});

test('an open HTML document reloads its iframe in place when a live change lands (FR-1)', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const { window } = dom;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).window = window;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).document = window.document;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const htmlArt = { fileName: 'V.html', kind: 'html' as const, label: 'Visual', title: null, isMarkdown: false };
  const root = createRoot(window.document.getElementById('root')!);
  await act(async () => {
    root.render(createElement(BufferedStage, {
      projectName: 'DEMO', artifact: htmlArt, markdownContent: null, activePulse: false,
    } as never));
  });
  // innerHTML HTML-encodes & as &amp; — decode to plain text for URL pattern matching.
  const decode = (html: string) => html.replace(/&amp;/g, '&');
  const before = decode(window.document.getElementById('root')!.innerHTML);
  assert.ok(!/[?&]v=\d/.test(before), 'no live-reload cache-bust before any change lands');
  await act(async () => {
    root.render(createElement(BufferedStage, {
      projectName: 'DEMO', artifact: htmlArt, markdownContent: null, activePulse: true,
    } as never));
  });
  // Flush any pending state updates triggered by effects (e.g. setLiveRefreshKey from the pulse effect).
  await act(async () => {});
  const after = decode(window.document.getElementById('root')!.innerHTML);
  assert.ok(/[?&]v=1/.test(after), 'front iframe reloads (cache-bust) when the open HTML doc changes in place');
  await act(async () => { root.unmount(); });
});
