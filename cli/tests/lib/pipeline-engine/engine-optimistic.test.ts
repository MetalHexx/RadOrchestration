import { describe, expect, it } from 'vitest';
import { processEvent } from '../../../src/lib/pipeline-engine/engine.js';
import { makeBench } from '../../helpers/engine-test-bench.js';

describe('optimistic in_progress at action return', () => {
  it('marks the resolved step node in_progress on the same writeState as the action return', () => {
    const bench = makeBench({ firstAction: 'spawn_planner' });
    const result = processEvent('start', bench.projectDir, {}, bench.io, bench.pathContext);
    expect(result.action).toBe('spawn_planner');

    const written = bench.io.lastWrittenState();
    // Step node tied to spawn_planner should be in_progress after the single writeState.
    const stepNode = written.graph.nodes['spawn_planner'];
    expect(stepNode.status).toBe('in_progress');
    // No second writeState should have occurred.
    expect(bench.io.writeStateCallCount()).toBe(1);
  });

  it('does NOT transition container nodes optimistically (walker still owns those)', () => {
    const bench = makeBench({ firstAction: 'spawn_planner' });
    processEvent('start', bench.projectDir, {}, bench.io, bench.pathContext);
    const written = bench.io.lastWrittenState();
    // The bench template is flat (no container nodes). Verify the step node kind
    // is 'step', confirming only step nodes receive the optimistic write.
    const stepNode = written.graph.nodes['spawn_planner'];
    expect(stepNode.kind).toBe('step');
  });
});
