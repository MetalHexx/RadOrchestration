/**
 * Tests for readConfig() ORCH_ROOT bootstrap and resolveOrchRoot().
 * Run with: npx tsx ui/lib/fs-reader-bootstrap.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readConfig, resolveOrchRoot } from './fs-reader';
import type { OrchestrationConfig } from '@/types/config';

let passed = 0;
let failed = 0;

const MINIMAL_CONFIG_YAML = `version: "1"
projects:
  base_path: "../orchestration-projects"
  naming: SCREAMING-CASE
limits:
  max_phases: 10
  max_tasks_per_phase: 20
  max_retries_per_task: 3
  max_consecutive_review_rejections: 3
human_gates:
  after_planning: true
  execution_mode: auto
  after_final_review: true
`;


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
  let tmpDir = '';

  try {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-bootstrap-test-'));

    // ── readConfig() bootstrap tests ──────────────────────────────────────

    console.log('\nreadConfig() — ORCH_ROOT bootstrap');

    await test('uses .github when ORCH_ROOT is not set', async () => {
      const configDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'orchestration.yml'), MINIMAL_CONFIG_YAML);

      delete process.env.ORCH_ROOT;
      const config = await readConfig(tmpDir);
      assert.strictEqual(config.version, '1');
    });

    await test('uses .agents when ORCH_ROOT=.agents', async () => {
      const configDir = path.join(tmpDir, '.agents', 'skills', 'orchestration', 'config');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'orchestration.yml'), MINIMAL_CONFIG_YAML);

      process.env.ORCH_ROOT = '.agents';
      const config = await readConfig(tmpDir);
      assert.strictEqual(config.version, '1');
      delete process.env.ORCH_ROOT;
    });

    await test('constructs path using ORCH_ROOT value', async () => {
      const configDir = path.join(tmpDir, '.copilot', 'skills', 'orchestration', 'config');
      await mkdir(configDir, { recursive: true });
      await writeFile(path.join(configDir, 'orchestration.yml'), MINIMAL_CONFIG_YAML);

      process.env.ORCH_ROOT = '.copilot';
      const config = await readConfig(tmpDir);
      assert.strictEqual(config.version, '1');
      delete process.env.ORCH_ROOT;
    });

    // ── resolveOrchRoot() tests ────────────────────────────────────────────

    console.log('\nresolveOrchRoot()');

    await test('returns system.orch_root when set', async () => {
      const config: OrchestrationConfig = {
        version: '1',
        system: { orch_root: '.agents' },
        projects: { base_path: '../projects', naming: 'SCREAMING-CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'auto', after_final_review: true },
      };
      assert.strictEqual(resolveOrchRoot(config), '.agents');
    });

    await test('returns .github when system.orch_root is undefined', async () => {
      const config: OrchestrationConfig = {
        version: '1',
        system: {},
        projects: { base_path: '../projects', naming: 'SCREAMING-CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'auto', after_final_review: true },
      };
      assert.strictEqual(resolveOrchRoot(config), '.github');
    });

    await test('returns .github when system property is absent', async () => {
      const config: OrchestrationConfig = {
        version: '1',
        projects: { base_path: '../projects', naming: 'SCREAMING-CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'auto', after_final_review: true },
      };
      assert.strictEqual(resolveOrchRoot(config), '.github');
    });

  } finally {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
