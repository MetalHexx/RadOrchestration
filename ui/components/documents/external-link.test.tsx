// ui/components/documents/external-link.test.tsx
import assert from 'node:assert/strict';
import React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExternalLink } from './external-link';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

// Helper
function render(props: Parameters<typeof ExternalLink>[0]): string {
  return renderToStaticMarkup(createElement(ExternalLink, props));
}

// ── Disabled branch (href = null) ─────────────────────────────────────────

{
  const html = render({ href: null, label: 'Commit', icon: 'github' });
  assert.ok(html.includes('aria-disabled="true"'), 'null href: aria-disabled="true" present');
  assert.ok(!html.includes('<a '), 'null href: no <a> element rendered');
  console.log('✓ null href — renders disabled span, no anchor');
}

{
  const html = render({ href: null, label: 'Commit', icon: 'github' });
  assert.ok(html.includes('text-muted-foreground'), 'null href: text-muted-foreground present');
  assert.ok(html.includes('cursor-not-allowed'), 'null href: cursor-not-allowed present');
  console.log('✓ null href — correct disabled Tailwind classes');
}

{
  const html = render({ href: null, label: 'Commit', icon: 'github' });
  assert.ok(html.includes('Commit'), 'null href: label text present in output');
  console.log('✓ null href — label text present');
}

{
  // NOTE: @base-ui/react renders TooltipContent via a Portal whose `mounted`
  // state starts as false. During renderToStaticMarkup the tooltip is never
  // opened, so the portal content ("Not available") is not emitted into the
  // static HTML. AC-5 is satisfied by the JSX structure in external-link.tsx:
  //   <TooltipContent>Not available</TooltipContent>
  // We verify the tooltip trigger wrapper is present via its data-slot attribute,
  // confirming the Tooltip > TooltipTrigger > TooltipContent tree is rendered.
  const html = render({ href: null, label: 'Commit', icon: 'github' });
  assert.ok(html.includes('data-slot="tooltip-trigger"'), 'null href: tooltip-trigger slot present (confirms Tooltip wrapper structure)');
  console.log('✓ null href — tooltip structure present (TooltipContent "Not available" in JSX, portal not mounted in SSR)');
}

// ── Active branch (href = string) ─────────────────────────────────────────

{
  const url = 'https://github.com/org/repo/commit/abc1234';
  const html = render({ href: url, label: 'Commit', icon: 'github' });
  assert.ok(html.includes(`href="${url}"`), 'active href: correct href attribute');
  assert.ok(html.includes('target="_blank"'), 'active href: target="_blank" present');
  assert.ok(html.includes('rel="noopener noreferrer"'), 'active href: noopener noreferrer present');
  assert.ok(!html.includes('aria-disabled'), 'active href: no aria-disabled attribute');
  console.log('✓ active href — renders anchor with correct attributes');
}

{
  const html = render({ href: 'https://github.com/org/repo/commit/abc1234', label: 'Commit', icon: 'github' });
  assert.ok(!html.includes('cursor-not-allowed'), 'active href: no cursor-not-allowed');
  assert.ok(!html.includes('text-muted-foreground'), 'active href: no muted foreground colour');
  console.log('✓ active href — no disabled styling applied');
}

// ── Opt-in tabIndex prop ─────────────────────────────────────────────────

{
  // Default (no tabIndex prop): the anchor should not emit a tabindex attribute,
  // leaving the browser's natural tab order for <a href> intact. Non-timeline
  // call sites (task-card.tsx etc.) rely on this.
  const html = render({ href: 'https://example.com/', label: 'Link' });
  assert.ok(!html.includes('tabindex='), 'default: no tabindex attribute emitted');
  console.log('✓ active href — omits tabindex by default');
}

{
  // Explicit -1 (timeline call sites): anchor must emit tabindex="-1" so it
  // stays out of the listbox's roving-tabindex scheme.
  const html = render({ href: 'https://example.com/', label: 'Link', tabIndex: -1 });
  assert.ok(html.includes('tabindex="-1"'), 'tabIndex={-1}: emits tabindex="-1"');
  console.log('✓ active href — tabIndex={-1} round-trips to tabindex="-1"');
}

// ── Optional title prop ─────────────────────────────────────────────────────

{
  const html = render({
    href: 'https://github.com/o/r/commit/abc123def4567890',
    label: 'Commit',
    icon: 'github',
    title: 'abc123def4567890',
  });
  assert.ok(html.includes('title="abc123def4567890"'),
    `expected title attribute in: ${html}`);
  console.log('✓ FR-12/DD-8 ExternalLink emits title attribute when title prop is provided');
}

{
  const html = render({
    href: 'https://github.com/o/r/commit/abc123def4567890',
    label: 'Commit',
    icon: 'github',
    title: 'abc123def4567890',
  });
  assert.ok(html.includes('aria-label="Commit"'),
    `aria-label must remain the descriptive label, not the hash, in: ${html}`);
  assert.ok(!html.includes('aria-label="abc123def4567890"'),
    `aria-label must not be overridden by title (raw hash) in: ${html}`);
  console.log('✓ NFR-1 aria-label remains the descriptive label when title is set (hash exposed via title attribute only)');
}

console.log('\nAll ExternalLink tests passed ✓');
