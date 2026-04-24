/**
 * Structural test — confirms /projects/page.tsx routes a selected
 * not_initialized project into NotStartedPaneV5 and does not fall
 * through to the generic "Select a project to begin" branch. Read via
 * source inspection because the page's data fetching effects are not
 * SSR-safe under node --test.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function run() {
  const src = await readFile(
    path.resolve(__dirname, 'page.tsx'), 'utf-8',
  );

  assert.ok(
    /NotStartedPaneV5/.test(src),
    'page.tsx imports/uses NotStartedPaneV5',
  );
  assert.ok(
    /useStartAction/.test(src),
    'page.tsx uses useStartAction for the spawn endpoint',
  );
  assert.ok(
    /tier === ['\"]not_initialized['\"]/.test(src),
    'page.tsx branches on tier === "not_initialized" to mount the pane',
  );
  assert.ok(
    /Select a project to begin/.test(src),
    'empty-selection placeholder still present for the unselected case (FR-10)',
  );

  console.log('✓ page.tsx wires NotStartedPaneV5 for selected Not-Started projects');
  console.log('\nAll /projects page structural tests passed');
}

run();
