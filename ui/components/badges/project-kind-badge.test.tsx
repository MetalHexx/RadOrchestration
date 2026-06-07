import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectKindBadge } from './project-kind-badge';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

test('renders nothing for a standard project (FR-18, DD-1)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'standard' }));
  assert.equal(html, '', 'standard project should render no kind badge');
  assert.ok(!html.includes('Standard'), 'must not render a "Standard" label');
});

test('renders nothing when project_type is absent (FR-18, DD-1)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: undefined }));
  assert.equal(html, '', 'absent project_type defaults to standard and renders nothing');
});

test('renders "Side Project" for a side-project (FR-19, DD-2)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'side-project' }));
  assert.ok(html.includes('Side Project'), 'should render "Side Project" label');
  assert.ok(!html.includes('Local'), 'label must not contain "Local"');
});

test('aria-label reflects project kind (NFR-1)', () => {
  const htmlSide = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'side-project' }));
  assert.ok(htmlSide.includes('Project kind: Side Project'), 'aria-label must say "Project kind: Side Project"');
  assert.ok(!htmlSide.includes('Local'), 'aria-label must not contain "Local"');
});
