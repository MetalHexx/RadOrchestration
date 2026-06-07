import { describe, it, expect } from 'vitest';
import { validateStateSchema } from '../../../src/lib/pipeline-engine/schema-validator.js';
import { makeV6State } from '../../helpers/state-factory.js';
import type { PipelineState } from '../../../src/lib/pipeline-engine/types.js';

function withProjectType(value: unknown): PipelineState {
  const s = makeV6State({ taskRepos: [{ name: 'rad-orc-source', commit_hash: null }] }) as unknown as { project: Record<string, unknown> };
  s.project.project_type = value;
  return s as unknown as PipelineState;
}

describe('v6 schema — project_type', () => {
  it('accepts project_type "standard"', () => {
    expect(validateStateSchema(withProjectType('standard'))).toEqual([]);
  });
  it('accepts project_type "side-project"', () => {
    expect(validateStateSchema(withProjectType('side-project'))).toEqual([]);
  });
  it('accepts state with project_type absent (backward-compatible default)', () => {
    expect(validateStateSchema(makeV6State({ taskRepos: [{ name: 'rad-orc-source', commit_hash: null }] }) as unknown as PipelineState)).toEqual([]);
  });
  it('rejects an out-of-enum project_type value', () => {
    const errors = validateStateSchema(withProjectType('follow-up'));
    expect(errors.some(e => e.includes('project.project_type'))).toBe(true);
  });
});
