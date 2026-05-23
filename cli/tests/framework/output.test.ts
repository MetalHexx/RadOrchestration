import { describe, expect, it, vi } from 'vitest';
import { emit, validateEnvelope } from '../../src/framework/output.js';

describe('emit', () => {
  it('writes exactly one JSON line on stdout for success', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit({ ok: true, data: { hello: 'world' } });
    expect(log).toHaveBeenCalledTimes(1);
    const arg = log.mock.calls[0]?.[0] as string;
    expect(JSON.parse(arg)).toEqual({ ok: true, data: { hello: 'world' } });
    log.mockRestore();
  });

  it('writes exactly one JSON line on stdout for failure', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit({ ok: false, error: { type: 'user_error', message: 'bad arg' } });
    const arg = log.mock.calls[0]?.[0] as string;
    expect(JSON.parse(arg)).toEqual({
      ok: false,
      error: { type: 'user_error', message: 'bad arg' },
    });
    log.mockRestore();
  });

  it('tolerates optional envelope fields without breaking consumers', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    emit({ ok: true, data: {}, warnings: ['stale'] } as never);
    const arg = log.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(arg);
    expect(parsed.warnings).toEqual(['stale']);
    log.mockRestore();
  });
});

describe('validateEnvelope', () => {
  it('accepts a valid success envelope', () => {
    expect(() => validateEnvelope({ ok: true, data: { x: 1 } })).not.toThrow();
  });

  it('rejects an envelope missing the ok discriminator', () => {
    expect(() => validateEnvelope({ data: {} } as never)).toThrow(/ok/);
  });

  it('rejects an error envelope with an unknown error.type', () => {
    expect(() =>
      validateEnvelope({ ok: false, error: { type: 'unknown', message: 'x' } } as never),
    ).toThrow(/error\.type/);
  });

  it('rejects an envelope with both data and error', () => {
    expect(() =>
      validateEnvelope({ ok: true, data: {}, error: { type: 'user_error', message: 'x' } } as never),
    ).toThrow(/data.*error|error.*data/i);
  });

  it('accepts ok:false with data.event when error is present', () => {
    expect(() =>
      validateEnvelope({ ok: false, data: { event: 'start' }, error: { type: 'user_error', message: 'x' } } as never),
    ).not.toThrow();
  });

  it('rejects ok:false when data.event is not a string', () => {
    expect(() =>
      validateEnvelope({ ok: false, data: { event: 42 }, error: { type: 'user_error', message: 'x' } } as never),
    ).toThrow(/event/);
  });

  it('accepts ok:false with data.field as a string', () => {
    expect(() =>
      validateEnvelope({ ok: false, data: { event: 'start', field: 'gate_type' }, error: { type: 'user_error', message: 'x' } } as never),
    ).not.toThrow();
  });

  it('rejects ok:false when data.field is not a string', () => {
    expect(() =>
      validateEnvelope({ ok: false, data: { event: 'start', field: 42 }, error: { type: 'user_error', message: 'x' } } as never),
    ).toThrow(/field/);
  });
});
