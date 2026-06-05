import { describe, it, expect } from 'vitest';
import { migrateV5ToV6 } from '../../../../src/lib/pipeline-engine/migrations/steps.js';
import { CURRENT_SCHEMA_VERSION } from '../../../../src/lib/pipeline-engine/migrations/version.js';
import { makeValidV5State } from '../../../helpers/state-factory.js';

describe('v5→v6 migration step (FR-16, FR-19)', () => {
  it('wraps commit_hash under a blank repo name and stamps v6 (FR-16, FR-28, DD-2)', () => {
    const v5 = makeValidV5State({ taskCommitHash: 'abc1234' });
    const v6 = migrateV5ToV6(v5);
    expect(v6.$schema).toBe('orchestration-state-v6');
    const taskEntry = (v6 as any).graph.nodes.phase_loop.iterations[0].nodes.task_loop.iterations[0];
    expect(taskEntry.repos).toEqual([{ name: '', commit_hash: 'abc1234' }]);
    const phaseEntry = (v6 as any).graph.nodes.phase_loop.iterations[0];
    expect(phaseEntry.repos).toEqual([{ name: '', commit_hash: null }]);
  });
  it('exposes orchestration-state-v6 as the current version (FR-17)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe('orchestration-state-v6');
  });
  it('rejects input that fails the archived v5 schema (FR-19, AD-6)', () => {
    const bad = makeValidV5State({ taskCommitHash: 'abc1234' }) as any;
    bad.graph.nodes.phase_loop.iterations[0].nodes.task_loop.iterations[0].status = 'bogus_status';
    expect(() => migrateV5ToV6(bad)).toThrow();
  });
});
