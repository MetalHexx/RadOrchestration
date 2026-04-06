/**
 * Tests for discoverProjects lastUpdated behavior.
 * Run with: npx tsx ui/lib/fs-reader-discover.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverProjects } from './fs-reader';

let passed = 0;
let failed = 0;
let tmpDir = '';

async function setup(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-discover-test-'));

  // (a) initialized-project: valid state.json with project.updated set
  await mkdir(path.join(dir, 'initialized-project'));
  await writeFile(
    path.join(dir, 'initialized-project', 'state.json'),
    JSON.stringify({
      $schema: 'orchestration-state-v4',
      project: {
        name: 'initialized-project',
        created: '2026-01-01T00:00:00.000Z',
        updated: '2026-04-06T12:00:00.000Z',
      },
      pipeline: {
        current_tier: 'execution',
        gate_mode: null,
      },
      planning: {
        status: 'complete',
        human_approved: true,
        steps: [],
      },
      execution: {
        status: 'not_started',
        current_phase: 0,
        phases: [],
      },
      final_review: {
        status: 'not_started',
        doc_path: null,
        human_approved: false,
      },
    })
  );

  // (b) no-state-project: directory without state.json
  await mkdir(path.join(dir, 'no-state-project'));

  // (c) malformed-project: state.json with invalid JSON
  await mkdir(path.join(dir, 'malformed-project'));
  await writeFile(path.join(dir, 'malformed-project', 'state.json'), 'not valid json{{{');

  return dir;
}

async function test(name: string, fn: () => Promise<void>) {
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
  tmpDir = await setup();
  const projects = await discoverProjects(tmpDir, '.');

  console.log('discoverProjects — lastUpdated behavior');

  await test('(a) initialized project — lastUpdated equals state.project.updated', async () => {
    const p = projects.find(x => x.name === 'initialized-project');
    assert.ok(p, 'initialized-project should be in results');
    assert.strictEqual(p!.lastUpdated, '2026-04-06T12:00:00.000Z');
  });

  await test('(b) not-initialized project — lastUpdated is undefined', async () => {
    const p = projects.find(x => x.name === 'no-state-project');
    assert.ok(p, 'no-state-project should be in results');
    assert.strictEqual(p!.lastUpdated, undefined);
  });

  await test('(c) malformed-state project — lastUpdated is undefined', async () => {
    const p = projects.find(x => x.name === 'malformed-project');
    assert.ok(p, 'malformed-project should be in results');
    assert.strictEqual(p!.lastUpdated, undefined);
  });

  // Cleanup
  await rm(tmpDir, { recursive: true });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
