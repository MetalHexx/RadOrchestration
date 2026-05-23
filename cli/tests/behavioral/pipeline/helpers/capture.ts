// cli/tests/behavioral/pipeline/helpers/capture.ts
import { vi } from 'vitest';

export async function captureEnvelope(fn: () => Promise<void>): Promise<{ ok: boolean; data?: unknown; error?: { type: string; message: string }; warnings?: string[] }> {
  const chunks: string[] = [];
  const w = vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => { chunks.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf8')); return true; });
  const l = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => { chunks.push(a.map(String).join(' ') + '\n'); });
  const x = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  try {
    await fn();
  } finally {
    w.mockRestore(); l.mockRestore(); x.mockRestore();
  }
  const joined = chunks.join('').trim();
  if (!joined) throw new Error('captureEnvelope: no stdout output captured');
  return JSON.parse(joined);
}
