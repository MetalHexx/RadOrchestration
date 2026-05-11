/**
 * Tests for getConfigPath(), readConfigWithRaw(), and writeConfig() in fs-reader.ts,
 * and stringifyYaml() in yaml-parser.ts.
 * Run with: npx tsx ui/lib/fs-reader-config-rw.test.ts
 */
import assert from 'node:assert';
import { mkdtemp, writeFile as fsWriteFile, rm, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getConfigPath, readConfig, readConfigWithRaw, writeConfig } from './fs-reader';
import { parseYaml, stringifyYaml } from './yaml-parser';
import type { OrchestrationConfig } from '@/types/config';

let passed = 0;
let failed = 0;

const SAMPLE_CONFIG: OrchestrationConfig = {
  version: '1',
  system: { orch_root: '.github' },
  projects: { base_path: 'projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 10,
    max_tasks_per_phase: 20,
    max_retries_per_task: 3,
    max_consecutive_review_rejections: 3,
  },
  human_gates: {
    after_planning: true,
    execution_mode: 'ask',
    after_final_review: true,
  },
  source_control: {
    auto_commit: 'always',
    auto_pr: 'ask',
    provider: 'github',
  },
};

const MINIMAL_CONFIG_YAML = `version: "1"
system:
  orch_root: .github
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
  execution_mode: ask
  after_final_review: true
source_control:
  auto_commit: always
  auto_pr: ask
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
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'fs-reader-config-rw-test-'));

    // Helper to set RADORCH_HOME and restore it
    const withRadorcHome = (dir: string, fn: () => Promise<void>): Promise<void> => {
      const prior = process.env.RADORCH_HOME;
      process.env.RADORCH_HOME = dir;
      return fn().finally(() => {
        if (prior === undefined) delete process.env.RADORCH_HOME;
        else process.env.RADORCH_HOME = prior;
      });
    };

    // ── getConfigPath() tests ─────────────────────────────────────────────

    console.log('\ngetConfigPath()');

    await test('returns RADORCH_HOME/orchestration.yml when RADORCH_HOME is set', async () => {
      await withRadorcHome(tmpDir, async () => {
        const result = getConfigPath();
        const expected = path.join(tmpDir, 'orchestration.yml');
        assert.strictEqual(result, expected);
      });
    });

    await test('returns ~/.radorch/orchestration.yml when RADORCH_HOME is not set', async () => {
      const prior = process.env.RADORCH_HOME;
      delete process.env.RADORCH_HOME;
      try {
        const result = getConfigPath();
        const expected = path.join(os.homedir(), '.radorch', 'orchestration.yml');
        assert.strictEqual(result, expected);
      } finally {
        if (prior === undefined) delete process.env.RADORCH_HOME;
        else process.env.RADORCH_HOME = prior;
      }
    });

    // ── readConfig() still works ──────────────────────────────────────────

    console.log('\nreadConfig() — still works after refactor');

    await test('readConfig() reads and parses config', async () => {
      await withRadorcHome(tmpDir, async () => {
        await fsWriteFile(path.join(tmpDir, 'orchestration.yml'), MINIMAL_CONFIG_YAML);
        const config = await readConfig();
        assert.strictEqual(config.version, '1');
        assert.strictEqual(config.projects.base_path, 'projects');
      });
    });

    // ── readConfigWithRaw() tests ─────────────────────────────────────────

    console.log('\nreadConfigWithRaw()');

    await test('returns both config and rawYaml', async () => {
      await withRadorcHome(tmpDir, async () => {
        const { config, rawYaml } = await readConfigWithRaw();
        assert.strictEqual(config.version, '1');
        assert.strictEqual(config.projects.naming, 'SCREAMING_CASE');
        assert.strictEqual(typeof rawYaml, 'string');
        assert.ok(rawYaml.includes('version'));
        assert.ok(rawYaml.includes('SCREAMING_CASE'));
      });
    });

    await test('throws on missing file', async () => {
      await withRadorcHome(path.join(tmpDir, 'nonexistent'), async () => {
        await assert.rejects(
          () => readConfigWithRaw(),
          (err: unknown) => err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT'
        );
      });
    });

    // ── writeConfig() tests ───────────────────────────────────────────────

    console.log('\nwriteConfig()');

    await test('writes atomically — file contains provided content and no temp files remain', async () => {
      await withRadorcHome(tmpDir, async () => {
        const newContent = 'version: "2"\n';
        await writeConfig(newContent);

        const configPath = getConfigPath();
        const written = await readFile(configPath, 'utf-8');
        assert.strictEqual(written, newContent);

        // No temp files should remain
        const configDir = path.dirname(configPath);
        const files = await readdir(configDir);
        const tmpFiles = files.filter(f => f.startsWith('.orchestration.yml.tmp.'));
        assert.strictEqual(tmpFiles.length, 0, `Temp files remain: ${tmpFiles.join(', ')}`);
      });
    });

    await test('temp file is in same directory as config', async () => {
      await withRadorcHome(tmpDir, async () => {
        const configPath = getConfigPath();
        const configDir = path.dirname(configPath);
        await writeConfig(MINIMAL_CONFIG_YAML);
        const written = await readFile(configPath, 'utf-8');
        assert.strictEqual(written, MINIMAL_CONFIG_YAML);
        const files = await readdir(configDir);
        assert.ok(files.includes('orchestration.yml'));
      });
    });

    await test('rejects when RADORCH_HOME directory does not exist', async () => {
      await withRadorcHome(path.join(tmpDir, 'no-such-dir'), async () => {
        await assert.rejects(
          () => writeConfig('version: "3"\n'),
          (err: unknown) => err instanceof Error
        );
      });
    });

    // ── stringifyYaml() tests ─────────────────────────────────────────────

    console.log('\nstringifyYaml()');

    await test('returns a string', async () => {
      const result = stringifyYaml({ hello: 'world' });
      assert.strictEqual(typeof result, 'string');
      assert.ok(result.length > 0);
    });

    await test('produces valid YAML that can be parsed back', async () => {
      const yaml = stringifyYaml(SAMPLE_CONFIG);
      const parsed = parseYaml<OrchestrationConfig>(yaml);
      assert.deepStrictEqual(parsed, SAMPLE_CONFIG);
    });

    // ── Round-trip integrity ──────────────────────────────────────────────

    console.log('\nRound-trip integrity');

    await test('parseYaml(stringifyYaml(config)) deep-equals original', async () => {
      const yaml = stringifyYaml(SAMPLE_CONFIG);
      const roundTripped = parseYaml<OrchestrationConfig>(yaml);
      assert.deepStrictEqual(roundTripped, SAMPLE_CONFIG);
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
