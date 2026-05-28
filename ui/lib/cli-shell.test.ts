import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import child_process from 'node:child_process';
import { EventEmitter } from 'node:events';
import { runCli } from './cli-shell.js';

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

function stubExecFile(stdout: string, exitNonZero = false): { calls: Array<{ file: string; args: string[] }> } {
  const calls: Array<{ file: string; args: string[] }> = [];
  mock.method(
    child_process,
    'execFile',
    (file: string, args: string[], _opts: unknown, cb: (...cbArgs: unknown[]) => void) => {
      calls.push({ file, args });
      // Node's execFile callback signature is (error, stdout, stderr) — three
      // positional args. Mocks must match this shape so a regression of the
      // 2-arg bug fails fast in tests.
      if (!exitNonZero) cb(null, stdout, '');
      else {
        const err: NodeJS.ErrnoException & { stdout?: string; stderr?: string } = new Error('nonzero');
        err.stdout = stdout;
        err.stderr = '';
        cb(err, stdout, '');
      }
      return {} as never;
    },
  );
  return { calls };
}

interface SpawnRecord {
  file: string;
  args: string[];
  stdinWritten: string;
}

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
      end: (data?: string) => {
        if (data !== undefined) record.stdinWritten += data;
      },
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

test('runCli returns system_error envelope when RADORCH_CLI_PATH is missing', async () => {
  delete process.env.RADORCH_CLI_PATH;
  const result = await runCli<{ x: number }>({ args: ['action-events', 'list-catalog'] });
  assert.strictEqual(result.envelope.ok, false);
  if (result.envelope.ok === false) {
    assert.strictEqual(result.envelope.error.type, 'system_error');
    assert.match(result.envelope.error.message, /RADORCH_CLI_PATH/);
  }
});

test('runCli execFiles RADORCH_CLI_PATH with argv and parses envelope on success', async () => {
  const { calls } = stubExecFile(JSON.stringify({ ok: true, data: { entries: [{ name: 'foo' }] } }));
  const result = await runCli<{ entries: Array<{ name: string }> }>({
    args: ['action-events', 'list-catalog'],
  });
  assert.strictEqual(result.envelope.ok, true);
  if (result.envelope.ok === true) {
    assert.deepEqual(result.envelope.data.entries, [{ name: 'foo' }]);
  }
  assert.strictEqual(calls.length, 1);
  const { file, args } = calls[0];
  assert.ok(file === process.execPath || file === 'node');
  assert.strictEqual(args[0], FAKE_CLI_PATH);
  assert.deepEqual(args.slice(1), ['action-events', 'list-catalog']);
});

test('runCli returns parsed failure envelope when CLI exits non-zero with valid JSON', async () => {
  stubExecFile(
    JSON.stringify({ ok: false, error: { type: 'user_error', message: 'bad input' }, exit_code: 1 }),
    true,
  );
  const result = await runCli<unknown>({ args: ['action-events', 'read-shipped', '--kind', 'action', '--name', 'x'] });
  assert.strictEqual(result.envelope.ok, false);
  if (result.envelope.ok === false) {
    assert.strictEqual(result.envelope.error.type, 'user_error');
    assert.strictEqual(result.envelope.error.message, 'bad input');
  }
});

test('runCli returns system_error envelope when stdout is not JSON', async () => {
  stubExecFile('not json at all');
  const result = await runCli<unknown>({ args: ['action-events', 'list-catalog'] });
  assert.strictEqual(result.envelope.ok, false);
  if (result.envelope.ok === false) {
    assert.strictEqual(result.envelope.error.type, 'system_error');
    assert.match(result.envelope.error.message, /Invalid CLI response/);
  }
});

test('runCli unwraps stdout from the 3-arg execFile callback (regression guard)', async () => {
  // Node's child_process.execFile callback is (error, stdout, stderr) — three
  // positional args, where stdout is a string. This test pins that contract:
  // a mock that invokes cb with three positional args (matching Node's real
  // behavior) must yield a parsed envelope. If runCli regresses to reading
  // stdout off a single result object, this test will fail with "Invalid CLI
  // response: empty stdout".
  const payload = JSON.stringify({ ok: true, data: { hello: 'world' } });
  mock.method(
    child_process,
    'execFile',
    (_file: string, _args: string[], _opts: unknown, cb: (...cbArgs: unknown[]) => void) => {
      cb(null, payload, '');
      return {} as never;
    },
  );
  const result = await runCli<{ hello: string }>({ args: ['action-events', 'list-catalog'] });
  assert.strictEqual(result.envelope.ok, true);
  if (result.envelope.ok === true) {
    assert.strictEqual(result.envelope.data.hello, 'world');
  }
  assert.strictEqual(result.rawStdout, payload);
});

test('runCli uses spawn and pipes stdin when opts.stdin is provided', async () => {
  const { calls } = stubSpawn(JSON.stringify({ ok: true, data: { ok: true } }));
  const stdinPayload = JSON.stringify({ content: 'hello\n' });
  const result = await runCli<{ ok: true }>({
    args: ['action-events', 'write-custom', '--kind', 'action', '--name', 'x', '--slot', 'pre'],
    stdin: stdinPayload,
  });
  assert.strictEqual(result.envelope.ok, true);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].stdinWritten, stdinPayload);
  assert.strictEqual(calls[0].args[0], FAKE_CLI_PATH);
});
