import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { runCompose } from '../../../src/commands/action-events/compose.js';
import { makeTempRoot, seedCatalog, seedComposeFixture } from './helpers.js';

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

describe('runCompose — has_custom_instructions and mode flag', () => {
  it('returns has_custom_instructions alongside prompt for kind=action', () => {
    const root = seedComposeFixture(); // existing helper
    fs.writeFileSync(path.join(root, 'custom', 'action.foo.pre.md'), 'pre');
    const out = runCompose({
      catalogRoot: root,
      kind: 'action',
      name: 'foo',
      completionEvent: null,
      mode: 'standalone',
    });
    expect(out.prompt).toMatch(/^## Step 1\n\npre\n\n## Step 2\n\nfoo body/);
    expect(out.has_custom_instructions).toBe(true);
  });

  it('mode=runtime-orphan with kind=event invokes composeOrphanRuntimeShape and emits the placeholder', () => {
    const root = seedComposeFixture();
    fs.writeFileSync(path.join(root, 'custom', 'event.kickoff.post.md'), 'post content');
    const out = runCompose({
      catalogRoot: root,
      kind: 'event',
      name: 'kickoff',
      completionEvent: null,
      mode: 'runtime-orphan',
    });
    expect(out.prompt).toBe(
      '## Step 1\n\npost content\n\n← the next action\'s prompt is composed here at runtime'
    );
    expect(out.has_custom_instructions).toBe(true);
  });

  it('mode=runtime-orphan with kind=action throws — runtime-orphan is event-only', () => {
    const root = seedComposeFixture();
    expect(() => runCompose({
      catalogRoot: root,
      kind: 'action',
      name: 'foo',
      completionEvent: null,
      mode: 'runtime-orphan',
    })).toThrow(/runtime-orphan/i);
  });

  it('default mode is standalone for kind=event (preserves composeOrphanEventPrompt)', () => {
    const root = seedComposeFixture();
    const out = runCompose({
      catalogRoot: root,
      kind: 'event',
      name: 'kickoff',
      completionEvent: null,
    });
    // standalone shape numbers admitted sections; no "next action" placeholder.
    expect(out.prompt).not.toMatch(/next action/);
    expect(out.prompt).toMatch(/^## Step 1\n/);
  });
});
