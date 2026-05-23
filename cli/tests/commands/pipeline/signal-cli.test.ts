import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipelineSignalCommand } from '../../../src/commands/pipeline/signal.js';
import { runCommand } from '../../../src/framework/command.js';

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', '..', 'runtime-config', 'templates');

function captureStdout(): { chunks: string[]; restore: () => void } {
  const chunks: string[] = [];
  const w = vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => { chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf8')); return true; });
  const l = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { chunks.push(a.map(String).join(' ') + '\n'); });
  const x = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  return { chunks, restore: () => { w.mockRestore(); l.mockRestore(); x.mockRestore(); } };
}

describe('radorch pipeline signal (FR-1, FR-2)', () => {
  it('emits the canonical envelope with data = { action, context } on success', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-cli-'));
    fs.copyFileSync(path.join(TEMPLATES_DIR, 'medium.yml'), path.join(dir, 'template.yml'));
    const cap = captureStdout();
    try {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'start', '--project-dir', dir, '--template', 'medium'],
        env: { ...process.env, RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr,
      });
    } finally { cap.restore(); }
    const env = JSON.parse(cap.chunks.join(''));
    expect(env.ok).toBe(true);
    expect(Object.keys(env.data).sort()).toEqual(['action', 'context']);
  });

  it('emits ok:false with data.event and error.type=user_error on an unknown event', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-cli-bad-'));
    fs.copyFileSync(path.join(TEMPLATES_DIR, 'medium.yml'), path.join(dir, 'template.yml'));
    const cap = captureStdout();
    try {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'definitely_not_an_event', '--project-dir', dir],
        env: { ...process.env, RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr,
      });
    } finally { cap.restore(); }
    const env = JSON.parse(cap.chunks.join(''));
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.data.event).toBe('definitely_not_an_event');
  });

  it('rejects malformed --parse-error JSON in the entry layer (AD-9)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-cli-pe-'));
    const cap = captureStdout();
    try {
      await runCommand(pipelineSignalCommand, {
        argv: ['--event', 'explosion_failed', '--project-dir', dir, '--parse-error', 'not-json'],
        env: { ...process.env, RADORCH_NO_LOG: '1' }, isTTY: false, stderr: process.stderr,
      });
    } finally { cap.restore(); }
    const env = JSON.parse(cap.chunks.join(''));
    expect(env.ok).toBe(false);
    expect(env.error.type).toBe('user_error');
    expect(env.data.field).toBe('parse-error');
  });
});
