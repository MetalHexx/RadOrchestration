import { describe, it, expect } from 'vitest';
import { mapStatus, combineStatuses, rollupProjectStatus } from '../src/derive/status.js';

describe('status mapping and rollup', () => {
  it('maps raw state.json node statuses into the closed vocabulary', () => {
    expect(mapStatus('completed')).toBe('done');
    expect(mapStatus('failed')).toBe('blocked');
    expect(mapStatus('halted')).toBe('blocked');
    expect(mapStatus('skipped')).toBe('skipped');
    expect(mapStatus('in_progress')).toBe('in_progress');
    expect(mapStatus('not_started')).toBe('not_started');
    expect(mapStatus('weird')).toBe('unknown');
  });
  it('combines per the blocked > in_progress > done > not_started rule', () => {
    expect(combineStatuses(['done', 'blocked', 'not_started'])).toBe('blocked');
    expect(combineStatuses(['done', 'not_started'])).toBe('in_progress'); // mix
    expect(combineStatuses(['in_progress', 'not_started'])).toBe('in_progress');
    expect(combineStatuses(['done', 'skipped'])).toBe('done'); // skipped counts as done
    expect(combineStatuses(['not_started', 'not_started'])).toBe('not_started');
    expect(combineStatuses([])).toBe('unknown');
    expect(combineStatuses(['unknown', 'unknown'])).toBe('unknown'); // none resolve
  });
  it('rolls a project status over its top-level graph.nodes', () => {
    expect(rollupProjectStatus({ graph: { nodes: {
      a: { status: 'completed' }, b: { status: 'in_progress' } } } })).toBe('in_progress');
    expect(rollupProjectStatus({ graph: { nodes: {
      a: { status: 'completed' }, b: { status: 'completed' } } } })).toBe('done');
  });
});
