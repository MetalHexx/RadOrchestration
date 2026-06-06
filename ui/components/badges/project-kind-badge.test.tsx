import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectKindBadge } from './project-kind-badge';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

test('renders "Standard" for a standard project (FR-18, DD-1)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'standard' }));
  assert.ok(html.includes('Standard'), 'should render "Standard" label');
});

test('renders "Local · side-project" for a side-project (FR-19, DD-2)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'side-project' }));
  assert.ok(html.includes('Local · side-project'), 'should render "Local · side-project" label');
});

test('treats an absent project_type as standard (FR-18, DD-1)', () => {
  const html = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: undefined }));
  assert.ok(html.includes('Standard'), 'absent project_type should default to "Standard"');
});

test('aria-label reflects project kind (NFR-1)', () => {
  const htmlStandard = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'standard' }));
  assert.ok(htmlStandard.includes('Project kind: Standard'), 'aria-label must say "Project kind: Standard"');

  const htmlSide = renderToStaticMarkup(createElement(ProjectKindBadge, { projectType: 'side-project' }));
  assert.ok(htmlSide.includes('Project kind: Local · side-project'), 'aria-label must say "Project kind: Local · side-project"');
});
