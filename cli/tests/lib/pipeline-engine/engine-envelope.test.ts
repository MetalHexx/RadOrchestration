import { describe, expect, it } from 'vitest';
import { processEvent } from '../../../src/lib/pipeline-engine/engine.js';
import { makeTestIO, seedCatalog, seedTemplate } from '../../helpers/engine-test-bench.js';

describe('success envelope carries top-level data.prompt and data.completion_event (FR-7)', () => {
  it('populates prompt with composed catalog text and completion_event with the resolved event name', () => {
    const bench = seedCatalog({
      'action.spawn_planner.md': {
        frontmatter: {
          kind: 'action', name: 'spawn_planner', title: 't', description: 'd',
          category: 'agent-spawn', completion_event: 'requirements_completed',
        },
        body: 'BODY-FROM-CATALOG',
      },
      'event.requirements_completed.md': {
        frontmatter: {
          kind: 'event', name: 'requirements_completed', title: 't', description: 'd',
          signal_payload: {},
        },
        body: 'EVENT-BODY',
      },
    });
    const tpl = seedTemplate({ firstAction: 'spawn_planner' });
    const io = makeTestIO({ catalog: bench.root, template: tpl });

    const result = processEvent('start', bench.projectDir, {}, io, bench.pathContext);
    expect(result.action).toBe('spawn_planner');
    expect(result.prompt).toContain('BODY-FROM-CATALOG');
    expect(result.prompt).toContain('Signal: requirements_completed');
    expect(result.completion_event).toBe('requirements_completed');
  });

  it('omits prompt and completion_event on failure envelopes', () => {
    const result = processEvent(
      'unknown_event',
      '/nonexistent',
      {},
      makeTestIO({ stateMissing: true }),
      { scriptsDir: '/x', templatesDir: '/x' },
    );
    expect(result.error).toBeDefined();
    expect(result.prompt).toBeUndefined();
    expect(result.completion_event).toBeUndefined();
  });
});
