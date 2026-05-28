import { describe, it, expect } from 'vitest';
import { runCompose } from '../../../src/commands/action-events/compose.js';
import { makeTempRoot, seedCatalog } from './helpers.js';

describe('action-events compose', () => {
  it('runCompose returns a string prompt for an action with completion event', () => {
    const root = makeTempRoot();
    seedCatalog(root);
    const result = runCompose({
      catalogRoot: root,
      kind: 'action',
      name: 'exec',
      completionEvent: 'done',
    });
    expect(typeof result.prompt).toBe('string');
    expect(result.prompt).toMatch(/Shipped action body\./);
    expect(result.prompt).toMatch(/Shipped event body\./);
  });

  it('runCompose returns a prompt for kind=event (orphan path)', () => {
    const root = makeTempRoot();
    seedCatalog(root);
    const result = runCompose({
      catalogRoot: root,
      kind: 'event',
      name: 'orphan',
      completionEvent: null,
    });
    expect(typeof result.prompt).toBe('string');
    expect(result.prompt).toMatch(/Orphan body\./);
  });

  it('runCompose honors the overlay parameter', () => {
    const root = makeTempRoot();
    seedCatalog(root);
    const result = runCompose({
      catalogRoot: root,
      kind: 'action',
      name: 'exec',
      completionEvent: 'done',
      overlay: { 'action.exec.pre': 'OVERLAY PRE' },
    });
    expect(result.prompt).toMatch(/OVERLAY PRE/);
  });
});
