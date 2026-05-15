/**
 * Tests for GET /api/templates/[id] and PUT /api/templates/[id] handlers.
 * Run with: npx tsx --test "app/api/templates/resource-route.test.ts" (from ui/ directory)
 *
 * Integration-style tests: creates a temp radorch home directory with a templates/
 * directory, stubs os.homedir to the temp dir, then exercises the GET and PUT
 * route handlers via Request objects.
 */
import assert from 'node:assert';
import { mkdtemp, mkdir, writeFile as fsWriteFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/* ------------------------------------------------------------------ */
/*  Test fixtures                                                      */
/* ------------------------------------------------------------------ */

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

const UPDATED_TEMPLATE_YAML = `template:
  id: test-template
  version: "2.0"
  description: An updated template
nodes:
  - id: step-1
    kind: step
    label: Updated Step
    depends_on: []
    action: run
`;

/* ------------------------------------------------------------------ */
/*  Temp workspace setup                                               */
/* ------------------------------------------------------------------ */

let tmpDir: string;
let templateDir: string;
let origHomedir: typeof os.homedir;

/** Create a temp radorch home with an empty templates/ dir */
async function setupWorkspace(): Promise<void> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'templates-id-test-'));
  templateDir = path.join(tmpDir, '.radorch', 'templates');
  await mkdir(templateDir, { recursive: true });
  origHomedir = os.homedir;
  (os as unknown as { homedir: () => string }).homedir = () => tmpDir;
}

async function teardownWorkspace(): Promise<void> {
  (os as unknown as { homedir: typeof os.homedir }).homedir = origHomedir;
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/*  Import the handlers (all dependencies are real, no mocks)          */
/* ------------------------------------------------------------------ */

import { GET, PUT } from './[id]/route';

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
  return new Request('http://localhost:3000/api/templates/test-template', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeBadRequest(body: string): Request {
  return new Request('http://localhost:3000/api/templates/test-template', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

async function run() {
  console.log('\nGET /api/templates/[id] and PUT /api/templates/[id] tests\n');

  // --- GET: valid existing ID returns 200 ---
  await test('GET — valid existing ID returns 200 with { rawYaml, definition }', async () => {
    await fsWriteFile(path.join(templateDir, 'test-template.yml'), TEMPLATE_YAML, 'utf-8');
    const res = await GET(
      new Request('http://localhost:3000/api/templates/test-template'),
      { params: Promise.resolve({ id: 'test-template' }) },
    );
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.ok(json.rawYaml, 'Response should contain rawYaml');
    assert.ok(json.definition, 'Response should contain definition');
    assert.strictEqual(json.definition.template.id, 'test-template');
    assert.strictEqual(json.definition.template.version, '1.0');
    assert.strictEqual(json.definition.template.description, 'A test template');
  });

  // --- GET: non-existent ID returns 404 ---
  await test('GET — non-existent ID returns 404 with error containing the ID', async () => {
    const res = await GET(
      new Request('http://localhost:3000/api/templates/missing-template'),
      { params: Promise.resolve({ id: 'missing-template' }) },
    );
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.ok(json.error.includes('missing-template'), `Expected ID in error: ${json.error}`);
  });

  // --- GET: path-traversal ID returns 400 ---
  await test('GET — path-traversal ID (../../etc/passwd) returns 400', async () => {
    const res = await GET(
      new Request('http://localhost:3000/api/templates/../../etc/passwd'),
      { params: Promise.resolve({ id: '../../etc/passwd' }) },
    );
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: valid content on existing template returns 200 ---
  await test('PUT — valid { content } on existing template returns 200 with { success: true }', async () => {
    await fsWriteFile(path.join(templateDir, 'test-template.yml'), TEMPLATE_YAML, 'utf-8');
    const req = makePutRequest({ content: UPDATED_TEMPLATE_YAML });
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
  });

  // --- PUT: verify file updated on disk ---
  await test('PUT — file is actually updated on disk after successful write', async () => {
    await fsWriteFile(path.join(templateDir, 'test-template.yml'), TEMPLATE_YAML, 'utf-8');
    const req = makePutRequest({ content: UPDATED_TEMPLATE_YAML });
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 200);
    const onDisk = await readFile(path.join(templateDir, 'test-template.yml'), 'utf-8');
    assert.ok(onDisk.includes('An updated template'), 'File on disk should contain updated content');
    assert.ok(onDisk.includes('2.0'), 'File on disk should reflect updated version');
  });

  // --- PUT: non-existent template returns 404 ---
  await test('PUT — non-existent template returns 404', async () => {
    const req = makePutRequest({ content: UPDATED_TEMPLATE_YAML });
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.ok(json.error.includes('test-template'), `Expected ID in error: ${json.error}`);
  });

  // --- PUT: path-traversal ID returns 400 ---
  await test('PUT — path-traversal ID returns 400', async () => {
    const req = new Request('http://localhost:3000/api/templates/../../evil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: UPDATED_TEMPLATE_YAML }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: '../../evil' }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: missing content field returns 400 ---
  await test('PUT — missing content field returns 400', async () => {
    const req = makePutRequest({});
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: invalid YAML content returns 400 ---
  await test('PUT — invalid YAML content returns 400', async () => {
    const req = makePutRequest({ content: '{ invalid: yaml: : :\n  bad:\n    - [' });
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: malformed JSON body returns 400 ---
  await test('PUT — malformed JSON body returns 400', async () => {
    const req = makeBadRequest('not json at all {{{');
    const res = await PUT(req, { params: Promise.resolve({ id: 'test-template' }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error, 'Invalid JSON body');
  });

  // --- GET: backslash path-traversal ID (..\\evil) returns 400 ---
  await test('GET — backslash path-traversal ID (..\\\\evil) returns 400', async () => {
    const res = await GET(
      new Request('http://localhost:3000/api/templates/..\\evil'),
      { params: Promise.resolve({ id: '..\\evil' }) },
    );
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: backslash path-traversal ID (..\\evil) returns 400 ---
  await test('PUT — backslash path-traversal ID (..\\\\evil) returns 400', async () => {
    const req = new Request('http://localhost:3000/api/templates/..\\evil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: UPDATED_TEMPLATE_YAML }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: '..\\evil' }) });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- GET: 404 when templates dir is missing (file not found) ---
  await test('GET — returns 404 when templates directory is missing', async () => {
    const { rm: fsRm } = await import('node:fs/promises');
    await fsRm(templateDir, { recursive: true, force: true });
    const res = await GET(
      new Request('http://localhost:3000/api/templates/test-template'),
      { params: Promise.resolve({ id: 'test-template' }) },
    );
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  // --- PUT: 404 when template file does not exist ---
  await test('PUT — returns 404 when template file does not exist in templates dir', async () => {
    const req = makePutRequest({ content: UPDATED_TEMPLATE_YAML });
    const res = await PUT(req, { params: Promise.resolve({ id: 'nonexistent-template' }) });
    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.ok(json.error, 'Should return an error message');
  });

  /* ------------------------------------------------------------------ */
  /*  Summary                                                            */
  /* ------------------------------------------------------------------ */

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run();
