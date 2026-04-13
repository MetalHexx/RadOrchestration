// ui/components/process-editor/template-group-node.test.tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemplateGroupNode } from './template-group-node';
import * as barrel from './index';
import type { TemplateGraphNodeData } from '@/types/template';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sourceText = readFileSync(join(__dirname, 'template-group-node.tsx'), 'utf-8');

const phaseData: TemplateGraphNodeData = {
  id: 'group-1',
  kind: 'for_each_phase',
  label: 'Phase Loop',
  meta: {},
};

const taskData: TemplateGraphNodeData = {
  id: 'group-2',
  kind: 'for_each_task',
  label: 'Task Loop',
  meta: {},
};

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
  console.log('template-group-node — TemplateGroupNode component');

  await test('renders without crashing for kind for_each_phase', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.length > 0, 'rendered HTML is non-empty');
  });

  await test('renders without crashing for kind for_each_task', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: taskData }));
    assert.ok(html.length > 0, 'rendered HTML is non-empty');
  });

  await test('Layers icon mapped to for_each_phase in source', () => {
    assert.ok(sourceText.includes('for_each_phase: Layers'), 'source maps for_each_phase to Layers');
  });

  await test('RefreshCcw icon mapped to for_each_task in source', () => {
    assert.ok(sourceText.includes('for_each_task: RefreshCcw'), 'source maps for_each_task to RefreshCcw');
  });

  await test('label text renders correctly', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.includes('Phase Loop'), 'label text is present in rendered HTML');
  });

  await test('kind subtitle renders correctly', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.includes('for_each_phase'), 'kind subtitle is present in rendered HTML');
  });

  await test('no Handle elements rendered — Handle not imported in source', () => {
    assert.ok(!sourceText.includes('Handle'), 'source does not import or use Handle');
  });

  await test('TemplateGroupNode is exported from barrel', () => {
    assert.strictEqual(typeof barrel.TemplateGroupNode, 'function', 'TemplateGroupNode is a function');
  });

  await test('TemplateGraphNode is still exported from barrel', () => {
    assert.strictEqual(typeof barrel.TemplateGraphNode, 'function', 'TemplateGraphNode is still exported');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();
