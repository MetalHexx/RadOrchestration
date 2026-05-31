import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SSEStatusBanner, shouldRenderSSEStatus } from './sse-status-banner';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

test('a healthy socket with a dead watcher renders a distinct live-paused banner (DD-12, FR-17)', () => {
  const html = renderToStaticMarkup(createElement(SSEStatusBanner, {
    status: 'connected', degraded: true, onReconnect: () => {},
  } as never));
  assert.ok(/live paused/i.test(html), 'copy distinguishes paused live updates');
  assert.ok(!/connection lost/i.test(html), 'not the connection-lost copy');
});

test('connected and not degraded still hides the banner (FR-17)', () => {
  assert.equal(shouldRenderSSEStatus('connected', false), false);
  assert.equal(shouldRenderSSEStatus('connected', true), true, 'degraded forces the banner visible while connected');
});

test('a lost socket keeps the existing connection-lost copy (DD-12)', () => {
  const html = renderToStaticMarkup(createElement(SSEStatusBanner, {
    status: 'disconnected', degraded: false, onReconnect: () => {},
  } as never));
  assert.ok(/unavailable|stale/i.test(html), 'connection-lost copy retained');
});

test('degraded banner renders em dash correctly (not literal escape sequence)', () => {
  const html = renderToStaticMarkup(createElement(SSEStatusBanner, {
    status: 'connected', degraded: true, onReconnect: () => {},
  } as never));
  assert.ok(!html.includes('\\u2014'), 'must not render literal \\u2014 escape text');
  assert.ok(html.includes('—'), 'renders a real em dash');
});
