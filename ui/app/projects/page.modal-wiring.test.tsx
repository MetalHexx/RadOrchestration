import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownPathForActive } from '@/hooks/use-artifact-modal';
import type { Artifact } from '@/lib/artifact-model';

const arts: Artifact[] = [
  { fileName: 'DEMO-BRAINSTORMING.md', kind: 'markdown', label: 'Brainstorm', title: null, isMarkdown: true },
  { fileName: 'DEMO-BRAINSTORM.html', kind: 'visual', label: 'Brainstorm Visual', title: null, isMarkdown: false },
];

test('returns the md filename when the active artifact is markdown (FR-12, AD-8)', () => {
  assert.equal(markdownPathForActive(arts, 0), 'DEMO-BRAINSTORMING.md');
});

test('returns null when the active artifact is html (AD-8)', () => {
  assert.equal(markdownPathForActive(arts, 1), null);
});

test('returns null when the index is out of range so the modal stays closed (FR-19)', () => {
  assert.equal(markdownPathForActive(arts, -1), null);
  assert.equal(markdownPathForActive(arts, 9), null);
});
