/**
 * Tests for readConfig() and resolveOrchRoot().
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
  base_path: "projects"
  naming: SCREAMING_CASE
limits:
  max_phases: 10
  max_tasks_per_phase: 20
  max_retries_per_task: 3
  max_consecutive_review_rejections: 3
human_gates:
  after_planning: true
  execution_mode: autonomous
  after_final_review: true
source_control:
  auto_commit: always
  auto_pr: never
  provider: github
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

    // ── readConfig() tests ────────────────────────────────────────────────

    console.log('\nreadConfig() — reads from ~/.radorch/orchestration.yml');

    await test('reads config from ~/.radorch/orchestration.yml', async () => {
      const radorcDir = path.join(tmpDir, '.radorch');
      await mkdir(radorcDir, { recursive: true });
      await writeFile(path.join(radorcDir, 'orchestration.yml'), MINIMAL_CONFIG_YAML);

      const origHomedir = os.homedir;
      (os as unknown as { homedir: () => string }).homedir = () => tmpDir;
      try {
        const config = await readConfig();
        assert.strictEqual(config.version, '1');
      } finally {
        (os as unknown as { homedir: () => string }).homedir = origHomedir;
      }
    });

    await test('throws when orchestration.yml does not exist', async () => {
      const fakeHome = path.join(tmpDir, 'nonexistent-home');
      const origHomedir = os.homedir;
      (os as unknown as { homedir: () => string }).homedir = () => fakeHome;
      try {
        await assert.rejects(
          () => readConfig(),
          (err: unknown) => err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
        );
      } finally {
        (os as unknown as { homedir: () => string }).homedir = origHomedir;
      }
    });

    // ── resolveOrchRoot() tests ────────────────────────────────────────────────

    console.log('\nresolveOrchRoot()');

    await test('returns system.orch_root when set', async () => {
      const config: OrchestrationConfig = {
        version: '1',
        system: { orch_root: '.agents' },
        projects: { base_path: 'projects', naming: 'SCREAMING_CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
        source_control: { auto_commit: 'always', auto_pr: 'never', provider: 'github' },
      };
      assert.strictEqual(resolveOrchRoot(config), '.agents');
    });

    await test('returns .claude when system.orch_root is undefined', async () => {
      const config = {
        version: '1',
        system: {},
        projects: { base_path: 'projects', naming: 'SCREAMING_CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
        source_control: { auto_commit: 'always', auto_pr: 'never', provider: 'github' },
      } as OrchestrationConfig;
      assert.strictEqual(resolveOrchRoot(config), '.claude');
    });

    await test('returns .claude when system property is absent', async () => {
      const config = {
        version: '1',
        projects: { base_path: 'projects', naming: 'SCREAMING_CASE' },
        limits: { max_phases: 10, max_tasks_per_phase: 20, max_retries_per_task: 3, max_consecutive_review_rejections: 3 },
        human_gates: { after_planning: true, execution_mode: 'autonomous', after_final_review: true },
        source_control: { auto_commit: 'always', auto_pr: 'never', provider: 'github' },
      } as OrchestrationConfig;
      assert.strictEqual(resolveOrchRoot(config), '.claude');
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
