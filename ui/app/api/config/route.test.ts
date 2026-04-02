/**
 * Tests for PUT /api/config handler in route.ts.
 * Run with: npx tsx ui/app/api/config/route.test.ts
 *
 * Integration-style tests: creates a temp workspace directory with a real
 * orchestration.yml, sets WORKSPACE_ROOT to the temp dir, then exercises the
 * GET and PUT route handlers via Request/Response objects.
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile as fsWriteFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { OrchestrationConfig } from '@/types/config';

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                      */
/* ------------------------------------------------------------------ */

const VALID_CONFIG: OrchestrationConfig = {
  version: '4',
  system: { orch_root: '.github/skills/orchestration' },
  projects: { base_path: '../orchestration-projects', naming: 'SCREAMING_CASE' },
  limits: {
    max_phases: 5,
    max_tasks_per_phase: 10,
    max_retries_per_task: 2,
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

const VALID_YAML = `version: "4"
system:
  orch_root: .github/skills/orchestration
projects:
  base_path: ../orchestration-projects
  naming: SCREAMING_CASE
limits:
  max_phases: 5
  max_tasks_per_phase: 10
  max_retries_per_task: 2
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

/* ------------------------------------------------------------------ */
/*  Temp workspace setup                                               */
/* ------------------------------------------------------------------ */

let tmpDir: string;

/** Create a temp workspace with orchestration.yml populated */
async function setupWorkspace(yamlContent: string = VALID_YAML): Promise<void> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'route-test-'));
  // getConfigPath uses: {root}/{ORCH_ROOT || .github}/skills/orchestration/config/orchestration.yml
  const configDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config');
  await mkdir(configDir, { recursive: true });
  await fsWriteFile(path.join(configDir, 'orchestration.yml'), yamlContent, 'utf-8');
  process.env.WORKSPACE_ROOT = tmpDir;
  // Ensure ORCH_ROOT is unset so it defaults to '.github'
  delete process.env.ORCH_ROOT;
}

async function teardownWorkspace(): Promise<void> {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/*  Import the handlers (all dependencies are real, no mocks)          */
/* ------------------------------------------------------------------ */

import { GET, PUT } from './route';

/* ------------------------------------------------------------------ */
/*  Test harness                                                       */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await setupWorkspace();
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  } finally {
    await teardownWorkspace();
  }
}

function makePutRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeBadRequest(body: string): Request {
  return new Request('http://localhost:3000/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

async function run() {
  console.log('\nPUT /api/config tests\n');

  // --- Form mode: valid config ---
  await test('form mode — valid config returns 200 with success and config', async () => {
  const req = makePutRequest({ mode: 'form', config: VALID_CONFIG });
  const res = await PUT(req);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(json.config, 'Response should contain config');
  assert.strictEqual(json.config.version, VALID_CONFIG.version);
  assert.strictEqual(json.config.limits.max_phases, VALID_CONFIG.limits.max_phases);
});

  // --- Form mode: validation errors ---
  await test('form mode — validation errors return 400 with details', async () => {
  const badConfig = {
    ...VALID_CONFIG,
    limits: { ...VALID_CONFIG.limits, max_phases: -1 },
  };
  const req = makePutRequest({ mode: 'form', config: badConfig });
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.error, 'Validation failed');
  assert.ok(json.details, 'Response should contain details');
  assert.ok(json.details['limits.max_phases'], 'Should have max_phases error');
});

  // --- Form mode: missing config ---
  await test('form mode — missing config returns 400', async () => {
  const req = makePutRequest({ mode: 'form' });
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.error, 'Missing config object for form mode');
});

  // --- Raw mode: valid YAML ---
  await test('raw mode — valid YAML returns 200 with success and config', async () => {
  const req = makePutRequest({ mode: 'raw', rawYaml: VALID_YAML });
  const res = await PUT(req);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.success, true);
  assert.ok(json.config, 'Response should contain config');
  assert.strictEqual(json.config.version, '4');
});

  // --- Raw mode: unparseable YAML ---
  await test('raw mode — unparseable YAML returns 400 with Invalid YAML', async () => {
  const req = makePutRequest({ mode: 'raw', rawYaml: '{ invalid: yaml: : :\n  bad:\n    - [' });
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.error.includes('Invalid YAML'), `Expected "Invalid YAML" in: ${json.error}`);
});

  // --- Raw mode: missing rawYaml ---
  await test('raw mode — missing rawYaml returns 400', async () => {
  const req = makePutRequest({ mode: 'raw' });
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.error, 'Missing rawYaml string for raw mode');
});

  // --- Invalid mode ---
  await test('invalid mode returns 400', async () => {
  const req = makePutRequest({ mode: 'invalid' });
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.ok(json.error.includes('Invalid mode'), `Expected "Invalid mode" in: ${json.error}`);
});

  // --- Malformed JSON ---
  await test('malformed JSON body returns 400', async () => {
  const req = makeBadRequest('not json at all {{{');
  const res = await PUT(req);
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.error, 'Invalid JSON body');
});

  // --- Read-back integrity ---
  await test('read-back integrity — returned config roundtrips correctly', async () => {
  const req = makePutRequest({ mode: 'form', config: VALID_CONFIG });
  const res = await PUT(req);
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.deepStrictEqual(json.config.limits, VALID_CONFIG.limits);
  assert.deepStrictEqual(json.config.human_gates, VALID_CONFIG.human_gates);
  assert.deepStrictEqual(json.config.source_control, VALID_CONFIG.source_control);

  // Verify the file was actually written on disk
  const configPath = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config', 'orchestration.yml');
  const onDisk = await readFile(configPath, 'utf-8');
  assert.ok(onDisk.includes('max_phases: 5'), 'Written file should contain max_phases: 5');
});

  // --- File-system error (write to non-existent dir) ---
  await test('non-writable config returns 403', async () => {
  // Point to a workspace that doesn't have the config dir
  const badDir = await mkdtemp(path.join(os.tmpdir(), 'route-test-bad-'));
  process.env.WORKSPACE_ROOT = badDir;
  const req = makePutRequest({ mode: 'form', config: VALID_CONFIG });
  const res = await PUT(req);
  assert.strictEqual(res.status, 403);
  const json = await res.json();
  assert.ok(json.error.includes('not writable'), `Expected writable error: ${json.error}`);
  await rm(badDir, { recursive: true, force: true });
});

  // --- GET handler still works ---
  await test('GET handler remains functional', async () => {
  const res = await GET();
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.ok(json.config, 'GET should return config');
  assert.ok(json.rawYaml, 'GET should return rawYaml');
  assert.strictEqual(json.config.version, '4');
});

/* ------------------------------------------------------------------ */
/*  Summary                                                            */
/* ------------------------------------------------------------------ */

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
