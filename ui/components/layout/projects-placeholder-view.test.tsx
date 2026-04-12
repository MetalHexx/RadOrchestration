import assert from 'node:assert';
import { ProjectsPlaceholderView } from './projects-placeholder-view';
import * as barrel from './index';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

async function run() {
  console.log('projects-placeholder-view — exports and structure');

  await test('ProjectsPlaceholderView is exported and is a function', () => {
    assert.strictEqual(typeof ProjectsPlaceholderView, 'function');
  });

  await test('ProjectsPlaceholderView is re-exported from the barrel', () => {
    assert.strictEqual(typeof barrel.ProjectsPlaceholderView, 'function');
  });

  await test('ProjectsPlaceholderView.name equals "ProjectsPlaceholderView"', () => {
    assert.strictEqual(ProjectsPlaceholderView.name, 'ProjectsPlaceholderView');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();
