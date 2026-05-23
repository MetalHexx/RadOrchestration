import { describe, expect, it } from 'vitest';
import { processEvent } from '../../../src/lib/pipeline-engine/engine.js';
import { validatePipelineState } from '../../../src/lib/pipeline-engine/schema-validator.js';
import schemaJson from '../../../src/lib/pipeline-engine/schemas/orchestration-state-v5.schema.json' with { type: 'json' };

describe('engine library lands at cli/src/lib/pipeline-engine/', () => {
  it('exposes processEvent from the new engine entry point', () => {
    expect(typeof processEvent).toBe('function');
  });
  it('schema artifact resolves through the sibling schemas/ folder', () => {
    expect((schemaJson as { $id?: string }).$id ?? '').toContain('orchestration-state-v5');
  });
  it('schema-validator imports the relocated schema cleanly', () => {
    expect(typeof validatePipelineState).toBe('function');
  });
});
