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
