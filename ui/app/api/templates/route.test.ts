/**
 * Tests for GET /api/templates and POST /api/templates handlers.
 * Run with: npx tsx --test ui/app/api/templates/route.test.ts (from ui/ directory)
 *
 * Integration-style tests: creates a temp workspace directory with a real
 * orchestration.yml and optional template .yml files, sets WORKSPACE_ROOT to the
 * temp dir, then exercises the GET and POST route handlers via Request objects.
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile as fsWriteFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                      */
/* ------------------------------------------------------------------ */

const VALID_YAML = `version: "4"
system:
  orch_root: .github
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

const TEMPLATE_YAML = `template:
  id: test-template
  version: "1.0"
  description: A test template
nodes:
  - id: step-1
    kind: step
    label: First Step
    depends_on: []
    action: research
`;

const NEW_TEMPLATE_YAML = `template:
  id: new-template
  version: "2.0"
  description: A new template
nodes:
  - id: step-1
    kind: step
    label: First Step
    depends_on: []
    action: run
`;

/* ------------------------------------------------------------------ */
/*  Temp workspace setup                                               */
/* ------------------------------------------------------------------ */

let tmpDir: string;

/** Create a temp workspace with orchestration.yml and an empty templates dir */
async function setupWorkspace(): Promise<void> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'templates-test-'));
  const configDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config');
  await mkdir(configDir, { recursive: true });
  await fsWriteFile(path.join(configDir, 'orchestration.yml'), VALID_YAML, 'utf-8');
  const templateDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'templates');
  await mkdir(templateDir, { recursive: true });
  process.env.WORKSPACE_ROOT = tmpDir;
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

import { GET, POST } from './route';

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

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeBadRequest(body: string): Request {
  return new Request('http://localhost:3000/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

async function run() {
  console.log('\nGET /api/templates and POST /api/templates tests\n');

  // --- GET: returns seeded template summaries ---
  await test('GET — returns 200 with templates array containing seeded template summaries', async () => {
    const templateDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'templates');
    await fsWriteFile(path.join(templateDir, 'test-template.yml'), TEMPLATE_YAML, 'utf-8');
    const res = await GET();
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.templates), 'templates should be an array');
    assert.strictEqual(json.templates.length, 1);
    assert.strictEqual(json.templates[0].id, 'test-template');
    assert.strictEqual(json.templates[0].description, 'A test template');
    assert.strictEqual(json.templates[0].version, '1.0');
  });

  // --- GET: empty templates directory ---
  await test('GET — returns 200 with empty templates array when no .yml files exist', async () => {
    const res = await GET();
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.templates), 'templates should be an array');
    assert.strictEqual(json.templates.length, 0);
  });

  // --- POST: valid body returns 201 ---
  await test('POST — valid { id, content } returns 201 with { success: true, id }', async () => {
    const req = makePostRequest({ id: 'new-template', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.id, 'new-template');
  });

  // --- POST: verify file written to disk ---
  await test('POST — file is actually written to disk after successful create', async () => {
    const req = makePostRequest({ id: 'my-template', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 201);
    const templateDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'templates');
    const onDisk = await readFile(path.join(templateDir, 'my-template.yml'), 'utf-8');
    assert.ok(onDisk.length > 0, 'Written file should not be empty');
    assert.ok(onDisk.includes('A new template'), 'Written file should contain template content');
  });

  // --- POST: duplicate ID returns 409 ---
  await test('POST — duplicate ID returns 409 with error containing the ID', async () => {
    const templateDir = path.join(tmpDir, '.github', 'skills', 'orchestration', 'templates');
    await fsWriteFile(path.join(templateDir, 'test-template.yml'), TEMPLATE_YAML, 'utf-8');
    const req = makePostRequest({ id: 'test-template', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 409);
    const json = await res.json();
    assert.ok(json.error.includes('test-template'), `Expected ID in error: ${json.error}`);
  });

  // --- POST: path-traversal ID (../evil) returns 400 ---
  await test('POST — path-traversal ID (../evil) returns 400', async () => {
    const req = makePostRequest({ id: '../evil', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- POST: path-traversal ID with slash (foo/bar) returns 400 ---
  await test('POST — path-traversal ID (foo/bar) returns 400', async () => {
    const req = makePostRequest({ id: 'foo/bar', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- POST: missing id field returns 400 ---
  await test('POST — missing id field returns 400', async () => {
    const req = makePostRequest({ content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- POST: missing content field returns 400 ---
  await test('POST — missing content field returns 400', async () => {
    const req = makePostRequest({ id: 'new-template' });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- POST: invalid YAML content returns 400 ---
  await test('POST — invalid YAML content returns 400', async () => {
    const req = makePostRequest({ id: 'new-template', content: '{ invalid: yaml: : :\n  bad:\n    - [' });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- POST: malformed JSON body returns 400 ---
  await test('POST — malformed JSON body returns 400', async () => {
    const req = makeBadRequest('not json at all {{{');
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error, 'Invalid JSON body');
  });

  // --- POST: backslash path-traversal ID (..\\evil) returns 400 ---
  await test('POST — backslash path-traversal ID (..\\\\evil) returns 400', async () => {
    const req = makePostRequest({ id: '..\\evil', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- GET: 500 when workspace config is unreadable ---
  await test('GET — returns 500 when orchestration.yml is missing', async () => {
    const { rm: fsRm } = await import('node:fs/promises');
    const configPath = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config', 'orchestration.yml');
    await fsRm(configPath);
    const res = await GET();
    assert.strictEqual(res.status, 500);
    const json = await res.json();
    assert.strictEqual(json.error, 'Internal server error');
  });

  // --- POST: 500 when workspace config is unreadable ---
  await test('POST — returns 500 when orchestration.yml is missing', async () => {
    const { rm: fsRm } = await import('node:fs/promises');
    const configPath = path.join(tmpDir, '.github', 'skills', 'orchestration', 'config', 'orchestration.yml');
    await fsRm(configPath);
    const req = makePostRequest({ id: 'new-template', content: NEW_TEMPLATE_YAML });
    const res = await POST(req);
    assert.strictEqual(res.status, 500);
    const json = await res.json();
    assert.strictEqual(json.error, 'Internal server error');
  });

  /* ------------------------------------------------------------------ */
  /*  Summary                                                            */
  /* ------------------------------------------------------------------ */

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
