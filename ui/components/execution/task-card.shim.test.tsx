// ui/components/execution/task-card.shim.test.tsx
// FR-24 / DD-4 — render coverage for the temporary lossy multi-repo shim.
// When a task iteration carries more than one repo entry, the card must surface
// a minimal multi-repo indicator (text + repo count). A single-repo task must
// not render it. Mirrors the renderToStaticMarkup pattern in
// documents/external-link.test.tsx.
import assert from 'node:assert/strict';
import React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskCard } from './task-card';
import type { Task, RepoCommitEntry } from '@/types/state';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

function makeTask(repos: RepoCommitEntry[]): Task {
  return {
    name: 'Build the thing',
    status: 'completed',
    stage: 'complete',
    docs: { handoff: null, review: null },
    review: { verdict: null, action: null },
    retries: 0,
    repos,
  };
}

function render(task: Task): string {
  return renderToStaticMarkup(
    createElement(TaskCard, {
      task,
      taskNumber: 1,
      maxRetries: 3,
      onDocClick: () => {},
      remoteUrl: 'https://github.com/org/repo',
    }),
  );
}

// ── Multi-repo task (repos.length > 1) → indicator present ──────────────────
{
  const html = render(
    makeTask([
      { name: 'backend', commit_hash: 'abc1234' },
      { name: 'shared', commit_hash: 'def5678' },
    ]),
  );
  assert.ok(/multi-repo/i.test(html), `multi-repo task: expected /multi-repo/i indicator in:\n${html}`);
  assert.ok(html.includes('2'), `multi-repo task: expected repo count "2" in:\n${html}`);
  console.log('✓ multi-repo task renders the lossy multi-repo indicator with the repo count');
}

// ── Single-repo task (repos.length === 1) → no indicator ────────────────────
{
  const html = render(makeTask([{ name: 'backend', commit_hash: 'abc1234' }]));
  assert.ok(!/multi-repo/i.test(html), `single-repo task: must NOT render a multi-repo indicator, got:\n${html}`);
  console.log('✓ single-repo task does not render the multi-repo indicator');
}

console.log('\nAll TaskCard multi-repo shim tests passed ✓');
