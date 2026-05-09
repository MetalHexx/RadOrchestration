import { describe, it, expect } from 'vitest';
import { validateDefaultTemplate, ALLOWED_DEFAULT_TEMPLATE_VALUES } from '../lib/config-validator.js';

describe('config-validator: default_template allowlist', () => {
  it('accepts the four tier names', () => {
    for (const v of ['extra-high', 'high', 'medium', 'low']) {
      expect(validateDefaultTemplate(v)).toEqual({ ok: true });
    }
  });

  it('accepts "ask"', () => {
    expect(validateDefaultTemplate('ask')).toEqual({ ok: true });
  });

  it('accepts the empty string', () => {
    expect(validateDefaultTemplate('')).toEqual({ ok: true });
  });

  it('rejects retired legacy values with a message citing the four-tier vocabulary', () => {
    for (const v of ['default', 'quick', 'full']) {
      const result = validateDefaultTemplate(v);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/extra-high.*high.*medium.*low/);
        expect(result.error).toContain(v);
      }
    }
  });

  it('exports the allowlist as a const for downstream consumers', () => {
    expect(new Set(ALLOWED_DEFAULT_TEMPLATE_VALUES)).toEqual(new Set(['extra-high','high','medium','low','ask','']));
  });
});
