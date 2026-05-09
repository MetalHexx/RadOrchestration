import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createFileSink } from '../../src/framework/logger/file-sink.js';
import { createLogger } from '../../src/framework/logger/logger.js';

let tmp: string;
beforeEach(async () => { tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rad-log-')); });
afterEach(async () => { await fs.rm(tmp, { recursive: true, force: true }); });

describe('logger NDJSON shape', () => {
  it('writes one JSON object per line with required fields', async () => {
    const sink = createFileSink({ file: path.join(tmp, 'cli.log'), maxBytes: 1024 * 1024, maxFiles: 5 });
    const log = createLogger({ level: 'info', sink, source: 'cli' });
    await log.info('hello', { command: 'install', args: { y: true }, duration_ms: 12, result: 'ok' });
    await log.flush();
    const lines = (await fs.readFile(path.join(tmp, 'cli.log'), 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!);
    expect(entry.level).toBe('info');
    expect(entry.source).toBe('cli');
    expect(entry.command).toBe('install');
    expect(entry.duration_ms).toBe(12);
    expect(typeof entry.timestamp).toBe('string');
  });

  it('honors level threshold — debug suppressed at info', async () => {
    const sink = createFileSink({ file: path.join(tmp, 'cli.log'), maxBytes: 1024 * 1024, maxFiles: 5 });
    const log = createLogger({ level: 'info', sink, source: 'cli' });
    await log.debug('quiet', {});
    await log.flush();
    const text = await fs.readFile(path.join(tmp, 'cli.log'), 'utf8').catch(() => '');
    expect(text.trim()).toBe('');
  });

  it('rotates when active log exceeds maxBytes', async () => {
    const file = path.join(tmp, 'cli.log');
    const sink = createFileSink({ file, maxBytes: 200, maxFiles: 3 });
    const log = createLogger({ level: 'info', sink, source: 'cli' });
    for (let i = 0; i < 20; i++) {
      await log.info(`msg-${i}`, { command: 'doctor', payload: 'x'.repeat(40) });
    }
    await log.flush();
    const entries = await fs.readdir(tmp);
    expect(entries).toContain('cli.log');
    expect(entries).toContain('cli.log.1');
  });

  it('is a no-op when RADORCH_NO_LOG is set', async () => {
    const file = path.join(tmp, 'cli.log');
    const sink = createFileSink({ file, maxBytes: 1024 * 1024, maxFiles: 5, env: { RADORCH_NO_LOG: '1' } });
    const log = createLogger({ level: 'info', sink, source: 'cli' });
    await log.info('hi', { command: 'x' });
    await log.flush();
    const exists = await fs.stat(file).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });

  it('skips writes cleanly when target directory does not exist', async () => {
    const file = path.join(tmp, 'no-such-dir', 'cli.log');
    const sink = createFileSink({ file, maxBytes: 1024 * 1024, maxFiles: 5, requireDirExists: true });
    const log = createLogger({ level: 'info', sink, source: 'cli' });
    await log.info('hi', { command: 'install' });
    await log.flush();
    const exists = await fs.stat(file).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  });
});
