import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FileText } from 'lucide-react';
import { SpinnerBadge } from './spinner-badge';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

function render(props: Parameters<typeof SpinnerBadge>[0]): string {
  return renderToStaticMarkup(createElement(SpinnerBadge, props));
}

test('renders the provided icon instead of the check when icon is set (AD-9)', () => {
  const html = render({
    label: 'Wireframe', cssVar: '--tier-planning', isSpinning: false,
    isComplete: true, icon: createElement(FileText, { size: 12 }),
  });
  // FileText lucide path differs from the Check icon path; assert no check polyline.
  assert.ok(!html.includes('M20 6 9 17l-5-5'), 'green check path absent when icon provided');
});

test('falls back to existing check behavior when no icon prop (AD-9, NFR-5)', () => {
  const html = render({ label: 'Done', cssVar: '--status-complete', isSpinning: false, isComplete: true });
  assert.ok(html.includes('svg'), 'an icon still renders');
});

test('spinning state still wins over icon (AD-9)', () => {
  const html = render({
    label: 'Working', cssVar: '--tier-planning', isSpinning: true,
    icon: createElement(FileText, { size: 12 }),
  });
  assert.ok(html.includes('animate-spin'), 'spinner takes precedence over custom icon');
});
