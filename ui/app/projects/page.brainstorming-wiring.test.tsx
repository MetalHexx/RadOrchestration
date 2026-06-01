import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBrainstormingArtifacts } from '@/hooks/use-project-artifacts';

test('selects the same ordered artifact set as the launch screen for the DAG section (FR-9, AD-6)', () => {
  const files = ['DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html', 'DEMO-WIREFRAME-DAG-VIEW.html', 'state.json'];
  const arts = selectBrainstormingArtifacts('DEMO', files);
  assert.deepEqual(arts.map((a) => a.fileName), [
    'DEMO-BRAINSTORMING.md', 'DEMO-BRAINSTORM.html', 'DEMO-WIREFRAME-DAG-VIEW.html',
  ]);
});

test('yields an empty set when no artifacts exist so the section can hide (FR-9, NFR-3)', () => {
  assert.deepEqual(selectBrainstormingArtifacts('DEMO', ['state.json']), []);
});

test('orders wireframes alphabetically by filename, never by mtime (stable across live edits) (FR-2)', () => {
  // Input array deliberately lists Z before A; ordering must be by filename, not
  // by input order and not by mtime (mtime would churn on every live edit).
  const files = [
    'DEMO-BRAINSTORMING.md',
    'DEMO-WIREFRAME-Z-SCREEN.html',
    'DEMO-WIREFRAME-A-SCREEN.html',
  ];
  const arts = selectBrainstormingArtifacts('DEMO', files);
  const wireframes = arts.filter((a) => a.kind === 'wireframe').map((a) => a.fileName);
  assert.deepEqual(wireframes, ['DEMO-WIREFRAME-A-SCREEN.html', 'DEMO-WIREFRAME-Z-SCREEN.html'],
    'wireframes are alphabetical by filename regardless of input order or mtime');
});
