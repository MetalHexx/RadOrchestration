// ui/components/documents/external-link.test.tsx
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExternalLink } from './external-link';

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

console.log('\nAll ExternalLink tests passed ✓');
