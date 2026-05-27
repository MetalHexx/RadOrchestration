import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { composeActionPrompt } from '../../../src/lib/pipeline-engine/composer.js';

function makeCatalog(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-'));
  fs.mkdirSync(path.join(dir, 'custom'), { recursive: true });
  return dir;
}

describe('composeActionPrompt — customs', () => {
  it('emits all three slot headings when matching customs exist', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.spawn_planner.md'), [
      '---', 'kind: action', 'name: spawn_planner', 'title: t', 'description: d',
      'category: agent-spawn', 'completion_event: requirements_completed', '---',
      'Main body.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'event.requirements_completed.md'), [
      '---', 'kind: event', 'name: requirements_completed', 'title: t', 'description: d',
      'signal_payload: {}', '---',
      'Event body.', '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'custom', 'action.spawn_planner.pre.md'), 'Pre-action custom.');
    fs.writeFileSync(path.join(dir, 'custom', 'event.requirements_completed.pre.md'), 'Pre-signal custom.');
    fs.writeFileSync(path.join(dir, 'custom', 'event.requirements_completed.post.md'), 'Post-signal custom.');

    const out = composeActionPrompt({
      actionName: 'spawn_planner', completionEvent: 'requirements_completed', catalogRoot: dir,
    });
    expect(out.indexOf('## Before doing this action')).toBeLessThan(out.indexOf('Main body.'));
    expect(out.indexOf('Main body.')).toBeLessThan(out.indexOf('## Before signaling'));
    expect(out.indexOf('## Before signaling')).toBeLessThan(out.indexOf('## When complete'));
    expect(out.indexOf('## When complete')).toBeLessThan(out.indexOf('## After signaling'));
  });

  it('throws when the envelope consumes an action whose custom pre exists but catalog is missing', () => {
    const dir = makeCatalog();
    // No action.ghost_action.md created — catalog is intentionally missing.
    fs.writeFileSync(path.join(dir, 'custom', 'action.ghost_action.pre.md'), 'pre body');

    expect(() => composeActionPrompt({
      actionName: 'ghost_action',
      completionEvent: null,
      catalogRoot: dir,
    })).toThrow(/action\.ghost_action\.md/);
  });

  it('does not throw when an unrelated custom for an unknown event is outside the current envelope (AD-7)', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.real_action.md'), [
      '---', 'kind: action', 'name: real_action', 'title: t', 'description: d',
      'category: gate', 'completion_event: null', '---', 'body', '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'custom', 'action.real_action.pre.md'), 'ok');
    // An UNRELATED custom for an unknown event — not consumed by this envelope, so does not fail.
    fs.writeFileSync(path.join(dir, 'custom', 'event.never_referenced.post.md'), 'ignored');

    // Composing action.real_action with no event should succeed (AD-7).
    expect(() => composeActionPrompt({
      actionName: 'real_action', completionEvent: null, catalogRoot: dir,
    })).not.toThrow();
  });

  it('errors when an event custom targets an unknown event name', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.with_event.md'), [
      '---', 'kind: action', 'name: with_event', 'title: t', 'description: d',
      'category: agent-spawn', 'completion_event: bogus_event', '---', 'body', '',
    ].join('\n'));
    // Custom referencing bogus_event exists and IS consumed by the envelope.
    fs.writeFileSync(path.join(dir, 'custom', 'event.bogus_event.pre.md'), 'oops');

    expect(() => composeActionPrompt({
      actionName: 'with_event', completionEvent: 'bogus_event', catalogRoot: dir,
    })).toThrow(/event\.bogus_event\.md/);
  });
});

describe('composeActionPrompt — bare (no customs)', () => {
  it('composes action body + When complete heading + signal line with flags', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.spawn_planner.md'), [
      '---',
      'kind: action', 'name: spawn_planner', 'title: t', 'description: d',
      'category: agent-spawn', 'completion_event: requirements_completed',
      '---',
      'Spawn the planner agent now.',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'event.requirements_completed.md'), [
      '---',
      'kind: event', 'name: requirements_completed', 'title: t', 'description: d',
      'signal_payload:',
      '  doc-path:',
      '    required: true',
      '    description: path to the requirements doc',
      '---',
      'Signal this after the requirements doc lands on disk.',
      '',
    ].join('\n'));

    const out = composeActionPrompt({
      actionName: 'spawn_planner',
      completionEvent: 'requirements_completed',
      catalogRoot: dir,
    });

    expect(out.startsWith('Spawn the planner agent now.')).toBe(true);
    expect(out).toContain('## When complete');
    expect(out).toContain('Signal this after the requirements doc lands on disk.');
    expect(out.trim().endsWith('Signal: requirements_completed --doc-path <value>')).toBe(true);
    expect(out).not.toContain('## Before doing this action');
    expect(out).not.toContain('## Before signaling');
    expect(out).not.toContain('## After signaling');
  });

  it('emits Signal: <event-name> with no flags when signal_payload is empty', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.gate_open.md'), [
      '---',
      'kind: action', 'name: gate_open', 'title: t', 'description: d',
      'category: gate', 'completion_event: gate_approved',
      '---',
      'Open the gate.',
      '',
    ].join('\n'));
    fs.writeFileSync(path.join(dir, 'event.gate_approved.md'), [
      '---',
      'kind: event', 'name: gate_approved', 'title: t', 'description: d',
      'signal_payload: {}',
      '---',
      'Signal after approval.',
      '',
    ].join('\n'));

    const out = composeActionPrompt({
      actionName: 'gate_open',
      completionEvent: 'gate_approved',
      catalogRoot: dir,
    });
    expect(out).toMatch(/Signal: gate_approved\s*$/);
  });

  it('omits When complete and After signaling for terminal actions', () => {
    const dir = makeCatalog();
    fs.writeFileSync(path.join(dir, 'action.display_complete.md'), [
      '---',
      'kind: action', 'name: display_complete', 'title: t', 'description: d',
      'category: terminal', 'completion_event: null',
      '---',
      'Display the completion screen.',
      '',
    ].join('\n'));

    const out = composeActionPrompt({
      actionName: 'display_complete',
      completionEvent: null,
      catalogRoot: dir,
    });
    expect(out).not.toContain('## When complete');
    expect(out).not.toContain('## After signaling');
    expect(out).not.toContain('Signal:');
  });
});
