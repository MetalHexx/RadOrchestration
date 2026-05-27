import { describe, it, expect } from 'vitest';
import { parseCustomSlotFilename } from '../../../src/lib/pipeline-engine/custom-slot.js';

describe('parseCustomSlotFilename', () => {
  it('parses action.<n>.pre.md', () => {
    expect(parseCustomSlotFilename('action.spawn_planner.pre.md'))
      .toEqual({ anchor: 'action', name: 'spawn_planner', slot: 'pre' });
  });
  it('parses event.<n>.pre.md', () => {
    expect(parseCustomSlotFilename('event.requirements_completed.pre.md'))
      .toEqual({ anchor: 'event', name: 'requirements_completed', slot: 'pre' });
  });
  it('parses event.<n>.post.md', () => {
    expect(parseCustomSlotFilename('event.requirements_completed.post.md'))
      .toEqual({ anchor: 'event', name: 'requirements_completed', slot: 'post' });
  });
  it('rejects action.<n>.post.md (not a recognized slot)', () => {
    expect(parseCustomSlotFilename('action.spawn_planner.post.md')).toBeNull();
  });
  it('rejects unrecognized shapes', () => {
    expect(parseCustomSlotFilename('README.md')).toBeNull();
    expect(parseCustomSlotFilename('action.spawn_planner.md')).toBeNull();
    expect(parseCustomSlotFilename('action.spawn_planner.pre.txt')).toBeNull();
  });
});
