import { describe, it, expect } from 'vitest';
import { parseActionEventFile } from '../../../src/lib/pipeline-engine/action-event-loader.js';

describe('parseActionEventFile', () => {
  it('parses a valid action file with all required fields', () => {
    const text = [
      '---',
      'kind: action',
      'name: spawn_planner',
      'title: Spawn planner',
      'description: Spawn the planner agent.',
      'category: agent-spawn',
      'completion_event: requirements_completed',
      '---',
      'Body here.',
      '',
    ].join('\n');
    const parsed = parseActionEventFile(text, 'action.spawn_planner.md');
    expect(parsed.kind).toBe('action');
    expect(parsed.name).toBe('spawn_planner');
    expect(parsed.frontmatter.completion_event).toBe('requirements_completed');
    expect(parsed.body.trim()).toBe('Body here.');
  });

  it('parses a valid event file with empty signal_payload', () => {
    const text = [
      '---',
      'kind: event',
      'name: requirements_completed',
      'title: Requirements completed',
      'description: Fires after requirements doc lands.',
      'signal_payload: {}',
      '---',
      'Signal this when the requirements doc is saved.',
      '',
    ].join('\n');
    const parsed = parseActionEventFile(text, 'event.requirements_completed.md');
    expect(parsed.kind).toBe('event');
    expect(parsed.frontmatter.signal_payload).toEqual({});
  });

  it('errors when frontmatter.name disagrees with filename stem', () => {
    const text = [
      '---',
      'kind: action',
      'name: wrong_name',
      'title: x',
      'description: x',
      'category: gate',
      'completion_event: null',
      '---',
      '',
    ].join('\n');
    expect(() => parseActionEventFile(text, 'action.spawn_planner.md'))
      .toThrow(/action\.spawn_planner\.md/);
  });

  it('errors when category is outside the allowed set', () => {
    const text = [
      '---',
      'kind: action',
      'name: x',
      'title: x',
      'description: x',
      'category: bogus',
      'completion_event: null',
      '---',
      '',
    ].join('\n');
    expect(() => parseActionEventFile(text, 'action.x.md'))
      .toThrow(/category/);
  });
});
