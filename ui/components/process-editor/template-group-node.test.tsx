// ui/components/process-editor/template-group-node.test.tsx
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
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

const conditionalData: TemplateGraphNodeData = {
  id: 'cond-1',
  kind: 'conditional',
  label: 'Commit Gate',
  meta: {},
};

let passed = 0;
let failed = 0;

function renderWithProvider(data: TemplateGraphNodeData): string {
  return renderToStaticMarkup(
    createElement(ReactFlowProvider, null, createElement(TemplateGroupNode, { data }))
  );
}

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
    const html = renderWithProvider(phaseData);
    assert.ok(html.length > 0, 'rendered HTML is non-empty');
  });

  await test('renders without crashing for kind for_each_task', () => {
    const html = renderWithProvider(taskData);
    assert.ok(html.length > 0, 'rendered HTML is non-empty');
  });

  await test('icon SVG is rendered for kind for_each_phase', () => {
    const html = renderWithProvider(phaseData);
    assert.ok(html.includes('<svg'), 'an SVG icon should be rendered for for_each_phase');
  });

  await test('icon SVG is rendered for kind for_each_task', () => {
    const html = renderWithProvider(taskData);
    assert.ok(html.includes('<svg'), 'an SVG icon should be rendered for for_each_task');
  });

  await test('label text renders correctly', () => {
    const html = renderWithProvider(phaseData);
    assert.ok(html.includes('Phase Loop'), 'label text is present in rendered HTML');
  });

  await test('kind subtitle renders correctly', () => {
    const html = renderWithProvider(phaseData);
    assert.ok(html.includes('Loop: each phase'), 'mapped label text for for_each_phase should be present in rendered HTML');
  });

  await test('kind subtitle renders correctly for kind for_each_task', () => {
    const html = renderWithProvider(taskData);
    assert.ok(html.includes('Loop: each task'), 'mapped label text for for_each_task should be present in rendered HTML');
  });

  await test('Handle components present in source (not testable in SSR)', () => {
    const source = readFileSync(join(__dirname, 'template-group-node.tsx'), 'utf-8');
    assert.ok(source.includes('<Handle'), 'source should contain Handle components');
  });

  await test('TemplateGroupNode is exported from barrel', () => {
    assert.ok(barrelSource.includes('TemplateGroupNode'), 'barrel should export TemplateGroupNode');
  });

  await test('TemplateGraphNode is still exported from barrel', () => {
    assert.ok(barrelSource.includes('TemplateGraphNode'), 'barrel should export TemplateGraphNode');
  });

  await test('has role="group" and aria-label matching the label', () => {
    const html = renderWithProvider(phaseData);
    assert.ok(html.includes('role="group"'), 'should have role="group"');
    assert.ok(html.includes(`aria-label="${phaseData.label}"`), 'should have aria-label matching data.label');
  });

  await test('renders without crashing for kind conditional', () => {
    const html = renderWithProvider(conditionalData);
    assert.ok(html.length > 0, 'rendered HTML is non-empty');
  });

  await test('icon SVG is rendered for kind conditional', () => {
    const html = renderWithProvider(conditionalData);
    assert.ok(html.includes('<svg'), 'an SVG icon should be rendered for conditional');
  });

  await test('conditional kind displays Conditional label', () => {
    const html = renderWithProvider(conditionalData);
    assert.ok(html.includes('Conditional'), 'should contain Conditional label text from kindLabelMap');
  });

  await test('conditional kind displays correct accent color', () => {
    const html = renderWithProvider(conditionalData);
    assert.ok(html.includes('--tier-execution'), 'should include --tier-execution accent from accentMap');
  });

  if (failed > 0) {
    console.error(`\n${failed} test(s) failed, ${passed} passed`);
    process.exit(1);
  } else {
    console.log(`\nAll ${passed} tests passed`);
  }
}

run();
