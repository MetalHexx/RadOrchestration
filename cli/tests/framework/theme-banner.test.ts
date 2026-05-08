import { describe, expect, it, vi } from 'vitest';
import { makeTheme } from '../../src/framework/theme.js';
import { renderBanner } from '../../src/framework/banner.js';

describe('theme', () => {
  it('produces no-op tokens when noColor=true', () => {
    const t = makeTheme({ noColor: true });
    expect(t.banner('x')).toBe('x');
    expect(t.success('y')).toBe('y');
  });
  it('decorates strings when noColor=false', () => {
    const t = makeTheme({ noColor: false });
    expect(t.banner('x')).not.toBe('x');
  });
});

describe('banner', () => {
  it('writes nothing when ux gates are off', () => {
    const stream = { write: vi.fn(), columns: 80, isTTY: true } as unknown as NodeJS.WriteStream;
    renderBanner({ stream, isTTY: false, nonInteractive: false, noColor: false, json: false });
    expect((stream.write as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
  it('writes only to the supplied stream when gates allow', () => {
    const stream = { write: vi.fn(), columns: 80, isTTY: true } as unknown as NodeJS.WriteStream;
    renderBanner({ stream, isTTY: true, nonInteractive: false, noColor: false, json: false });
    expect((stream.write as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });
});
