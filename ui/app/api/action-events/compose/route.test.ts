import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import child_process from 'node:child_process';
import { EventEmitter } from 'node:events';
import { POST } from './route.js';

const FAKE_CLI_PATH = '/fake/install/skills/rad-orchestration/scripts/radorch.mjs';
const ORIGINAL_CLI_PATH = process.env.RADORCH_CLI_PATH;

beforeEach(() => {
  process.env.RADORCH_CLI_PATH = FAKE_CLI_PATH;
});

afterEach(() => {
  mock.restoreAll();
  if (ORIGINAL_CLI_PATH === undefined) delete process.env.RADORCH_CLI_PATH;
  else process.env.RADORCH_CLI_PATH = ORIGINAL_CLI_PATH;
});

interface SpawnRecord { file: string; args: string[]; stdinWritten: string }

function stubSpawn(stdout: string, exitCode = 0): { calls: SpawnRecord[] } {
  const calls: SpawnRecord[] = [];
  mock.method(child_process, 'spawn', (file: string, args: string[], _opts: unknown) => {
    const record: SpawnRecord = { file, args, stdinWritten: '' };
    calls.push(record);
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
      stdin: { end: (data?: string) => void; on: EventEmitter['on'] };
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const stdinEmitter = new EventEmitter();
    child.stdin = {
      end: (data?: string) => { if (data !== undefined) record.stdinWritten += data; },
      on: stdinEmitter.on.bind(stdinEmitter) as EventEmitter['on'],
    };
    setImmediate(() => {
      child.stdout.emit('data', stdout);
      child.emit('close', exitCode);
    });
    return child as unknown as child_process.ChildProcess;
  });
  return { calls };
}

test('action compose shells out with --kind/--name/--completion-event and pipes overlay (FR-31, NFR-3)', async () => {
  const { calls } = stubSpawn(JSON.stringify({ ok: true, data: { prompt: 'COMPOSED' } }));
  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({
      kind: 'action', name: 'exec', completion_event: 'done',
      overlay: { 'action.exec.pre': 'LIVE PRE' },
    }),
  });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.prompt, 'COMPOSED');
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].args[0], FAKE_CLI_PATH);
  assert.deepEqual(calls[0].args.slice(1), ['action-events', 'compose', '--kind', 'action', '--name', 'exec', '--completion-event', 'done']);
  assert.deepEqual(JSON.parse(calls[0].stdinWritten), { overlay: { 'action.exec.pre': 'LIVE PRE' } });
});

test('orphan event compose omits --completion-event (FR-31, AD-3)', async () => {
  const { calls } = stubSpawn(JSON.stringify({ ok: true, data: { prompt: 'EVENT_COMPOSED' } }));
  const req = new Request('http://x', {
    method: 'POST',
    body: JSON.stringify({ kind: 'event', name: 'lonely', overlay: { 'event.lonely.post': 'LIVE POST' } }),
  });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.prompt, 'EVENT_COMPOSED');
  assert.deepEqual(calls[0].args.slice(1), ['action-events', 'compose', '--kind', 'event', '--name', 'lonely']);
  assert.deepEqual(JSON.parse(calls[0].stdinWritten), { overlay: { 'event.lonely.post': 'LIVE POST' } });
});

test('compose sends overlay={} stdin when payload omits overlay (FR-31)', async () => {
  const { calls } = stubSpawn(JSON.stringify({ ok: true, data: { prompt: 'P' } }));
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'event', name: 'lonely' }) });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 200);
  assert.deepEqual(JSON.parse(calls[0].stdinWritten), { overlay: {} });
});

test('compose rejects invalid kind with 400 BEFORE spawning (NFR-6)', async () => {
  const { calls } = stubSpawn(JSON.stringify({ ok: true, data: { prompt: 'should not run' } }));
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'banana', name: 'x' }) });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(calls.length, 0);
});

test('compose returns 500 when CLI envelope reports an error', async () => {
  stubSpawn(JSON.stringify({ ok: false, error: { type: 'system_error', message: 'compose boom' } }), 1);
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'event', name: 'lonely' }) });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 500);
  const body = await res.json();
  assert.match(body.error, /compose boom/);
});

test('compose returns 500 when RADORCH_CLI_PATH is missing', async () => {
  delete process.env.RADORCH_CLI_PATH;
  const req = new Request('http://x', { method: 'POST', body: JSON.stringify({ kind: 'event', name: 'lonely' }) });
  const res = await POST(req as unknown as Parameters<typeof POST>[0]);
  assert.strictEqual(res.status, 500);
  const body = await res.json();
  assert.match(JSON.stringify(body), /RADORCH_CLI_PATH/);
});
