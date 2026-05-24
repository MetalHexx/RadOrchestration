import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { runHello } from '../../src/commands/hello/index.js';

function makeStdout(): { stream: NodeJS.WriteStream; read: () => string } {
  const chunks: Buffer[] = [];
  const pt = new PassThrough();
  pt.on('data', (chunk: Buffer) => chunks.push(chunk));
  return {
    stream: pt as unknown as NodeJS.WriteStream,
    read: () => Buffer.concat(chunks).toString('utf8'),
  };
}

describe('runHello', () => {
  it('writes "Hello, World!\\n" to stdout and returns exit code 0', async () => {
    const out = makeStdout();
    const code = await runHello({ stdout: out.stream });
    expect(code).toBe(0);
    expect(out.read()).toBe('Hello, World!\n');
  });

  it('writes nothing to stderr', async () => {
    const stderrChunks: Buffer[] = [];
    const stderrPt = new PassThrough();
    stderrPt.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    const stderr = stderrPt as unknown as NodeJS.WriteStream;

    const out = makeStdout();
    await runHello({ stdout: out.stream, stderr });
    expect(Buffer.concat(stderrChunks).toString('utf8')).toBe('');
  });
});
