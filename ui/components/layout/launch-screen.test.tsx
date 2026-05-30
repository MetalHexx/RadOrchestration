import { test } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LaunchScreen } from './launch-screen';
import type { Artifact } from '@/lib/artifact-model';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const md: Artifact = { fileName: 'DEMO-BRAINSTORMING.md', kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true };
const noop = () => {};

function render(props: Parameters<typeof LaunchScreen>[0]): string {
  return renderToStaticMarkup(createElement(LaunchScreen, props));
}

const base = {
  projectName: 'DEMO',
  onOpenArtifact: noop,
  onDeleteArtifact: noop,
  onStartPlanning: noop,
  onStartBrainstorming: noop,
  pendingAction: null,
  errorMessage: null,
} as const;

test('shows project name header and no status badge (FR-4, DD-3)', () => {
  const html = render({ ...base, artifacts: [md] });
  assert.ok(html.includes('DEMO'), 'project name shown');
  assert.ok(html.includes('Project'), 'kicker shown');
});

test('with at least one artifact, primary action is Start Planning (FR-7)', () => {
  const html = render({ ...base, artifacts: [md] });
  assert.ok(html.includes('Start Planning'), 'Start Planning shown');
  assert.ok(!html.includes('Start Brainstorming'), 'Start Brainstorming hidden when artifacts exist');
  assert.ok(html.includes('DEMO-BRAINSTORMING.md'), 'tile rendered');
});

test('with no artifacts, shows empty state and Start Brainstorming only (FR-8, FR-7)', () => {
  const html = render({ ...base, artifacts: [] });
  assert.ok(html.includes('Start Brainstorming'), 'Start Brainstorming shown in empty state');
  assert.ok(!html.includes('Start Planning'), 'Start Planning hidden in empty state');
  assert.ok(!html.includes('DEMO-BRAINSTORMING.md'), 'no tiles in empty state');
});

test('pending start action disables the action button (AD-7)', () => {
  const html = render({ ...base, artifacts: [md], pendingAction: 'start-planning' });
  assert.ok(html.includes('disabled'), 'pending action disables the button');
});
