import { describe, it, expect } from 'vitest';
import { getMutation } from '../../../src/lib/pipeline-engine/mutations.js';

describe('source_control_init retirement (FR-6, AD-2)', () => {
  it('no longer registers a SOURCE_CONTROL_INIT mutation', () => {
    expect(getMutation('source_control_init')).toBeUndefined();
  });
});
