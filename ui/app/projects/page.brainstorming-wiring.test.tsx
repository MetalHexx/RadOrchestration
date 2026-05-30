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

test('orders wireframes by ascending mtime when mtimes arg is supplied, ignoring filename order (FR-2)', () => {
  // Files listed in alphabetical order — A before Z in the input array
  const files = [
    'DEMO-BRAINSTORMING.md',
    'DEMO-WIREFRAME-A-SCREEN.html',
    'DEMO-WIREFRAME-Z-SCREEN.html',
  ];
  // A-SCREEN has HIGHER mtime than Z-SCREEN, so Z-SCREEN should sort FIRST by mtime.
  // Without mtimes being threaded through (current behavior: passes {}),
  // deriveArtifacts sees mtime 0 for both and preserves input order (A first).
  // With mtimes applied, Z-SCREEN (mtime 100) must come before A-SCREEN (mtime 200).
  const mtimes: Record<string, number> = {
    'DEMO-WIREFRAME-A-SCREEN.html': 200,
    'DEMO-WIREFRAME-Z-SCREEN.html': 100,
  };
  const arts = selectBrainstormingArtifacts('DEMO', files, mtimes);
  const wireframes = arts.filter((a) => a.kind === 'wireframe').map((a) => a.fileName);
  assert.deepEqual(wireframes, ['DEMO-WIREFRAME-Z-SCREEN.html', 'DEMO-WIREFRAME-A-SCREEN.html'],
    'lower-mtime wireframe must come first regardless of input/filename order');
});
