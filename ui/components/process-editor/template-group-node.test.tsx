// ui/components/process-editor/template-group-node.test.tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemplateGroupNode } from './template-group-node';
import type { TemplateGraphNodeData } from '@/types/template';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read barrel source to verify exports without triggering CSS import chain
const barrelSource = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

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

  await test('icon SVG is rendered for kind for_each_phase', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.includes('<svg'), 'an SVG icon should be rendered for for_each_phase');
  });

  await test('icon SVG is rendered for kind for_each_task', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: taskData }));
    assert.ok(html.includes('<svg'), 'an SVG icon should be rendered for for_each_task');
  });

  await test('label text renders correctly', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.includes('Phase Loop'), 'label text is present in rendered HTML');
  });

  await test('kind subtitle renders correctly', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(html.includes('for_each_phase'), 'kind subtitle is present in rendered HTML');
  });

  await test('no Handle elements rendered in output', () => {
    const html = renderToStaticMarkup(createElement(TemplateGroupNode, { data: phaseData }));
    assert.ok(!html.includes('react-flow__handle'), 'rendered output should not contain Handle elements');
  });

  await test('TemplateGroupNode is exported from barrel', () => {
    assert.ok(barrelSource.includes('TemplateGroupNode'), 'barrel should export TemplateGroupNode');
  });

  await test('TemplateGraphNode is still exported from barrel', () => {
    assert.ok(barrelSource.includes('TemplateGraphNode'), 'barrel should export TemplateGraphNode');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();
