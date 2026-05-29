import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { composeActionPrompt } from '../../../src/lib/pipeline-engine/composer.js';

function seedCatalog(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'composer-overlay-'));
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'action.exec.md'),
    '---\nkind: action\nname: exec\ntitle: Exec\ndescription: Run a task.\ncategory: agent-spawn\ncompletion_event: done\n---\n\nShipped action body.\n',
  );
  fs.writeFileSync(
    path.join(root, 'event.done.md'),
    '---\nkind: event\nname: done\ntitle: Done\ndescription: A done signal.\nsignal_payload: {}\n---\n\nShipped event body.\n',
  );
  return root;
}

describe('composeActionPrompt — overlay', () => {
  it('byte-identical output when overlay is omitted (NFR-9)', () => {
    const root = seedCatalog();
    fs.writeFileSync(path.join(root, 'custom', 'action.exec.pre.md'), 'DISK PRE\n');
    const a = composeActionPrompt({ actionName: 'exec', completionEvent: 'done', catalogRoot: root });
    const b = composeActionPrompt({ actionName: 'exec', completionEvent: 'done', catalogRoot: root, overlay: undefined });
    expect(a.prompt).toBe(b.prompt);
    expect(a.prompt).toMatch(/DISK PRE/);
  });

  it('overlay value supersedes on-disk custom (AD-3)', () => {
    const root = seedCatalog();
    fs.writeFileSync(path.join(root, 'custom', 'action.exec.pre.md'), 'DISK PRE\n');
    const out = composeActionPrompt({
      actionName: 'exec',
      completionEvent: 'done',
      catalogRoot: root,
      overlay: { 'action.exec.pre': 'OVERLAY PRE' },
    });
    expect(out.prompt).toMatch(/OVERLAY PRE/);
    expect(out.prompt).not.toMatch(/DISK PRE/);
  });

  it('overlay populates a slot with no on-disk file (AD-3)', () => {
    const root = seedCatalog();
    const out = composeActionPrompt({
      actionName: 'exec',
      completionEvent: 'done',
      catalogRoot: root,
      overlay: { 'event.done.post': 'OVERLAY POST' },
    });
    expect(out.prompt).toMatch(/OVERLAY POST/);
  });

  it('empty-string overlay value suppresses the slot (AD-3)', () => {
    const root = seedCatalog();
    fs.writeFileSync(path.join(root, 'custom', 'event.done.pre.md'), 'DISK EVT PRE\n');
    const out = composeActionPrompt({
      actionName: 'exec',
      completionEvent: 'done',
      catalogRoot: root,
      overlay: { 'event.done.pre': '' },
    });
    expect(out.prompt).not.toMatch(/DISK EVT PRE/);
  });
});
