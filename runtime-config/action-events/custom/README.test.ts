import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'README.md'), 'utf-8');

const SECTIONS = [
  'What customs do',
  'The three slots',
  'Filename convention is the contract',
  'What changes vs. what doesn',
  'Use-case gallery',
  'Authoring guidance',
  'Where customs live on disk',
];

test('README contains the seven sections in order (FR-34)', () => {
  let cursor = 0;
  for (const s of SECTIONS) {
    const idx = src.indexOf(s, cursor);
    assert.ok(idx >= 0, `missing section: ${s}`);
    cursor = idx;
  }
});

test('README explicitly corrects the prior frontmatter claim (FR-34)', () => {
  assert.match(src, /no\s+frontmatter|without\s+frontmatter|do\s+not\s+include\s+(any\s+)?frontmatter/i);
});

test('Use-case gallery seeds five named recipes with target filenames (FR-35)', () => {
  const expected = [
    'event.pr_created.post.md',
    'action.spawn_phase_reviewer.pre.md',
    'event.task_completed.post.md',
    'event.plan_approved.post.md',
    'action.execute_task.pre.md',
  ];
  for (const filename of expected) assert.match(src, new RegExp(filename.replace(/\./g, '\\.')), `expected recipe filename ${filename}`);
});
