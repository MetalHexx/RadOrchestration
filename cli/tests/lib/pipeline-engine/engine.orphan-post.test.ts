import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isOrphanEvent,
  readOrphanPostContent,
  attachPromptIfActionResolved,
  __setActionEventsRootForTests,
} from '../../../src/lib/pipeline-engine/engine.js';
import type { PipelineTemplate } from '../../../src/lib/pipeline-engine/types.js';

const cleanups: Array<() => void> = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });

function seedRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-orphan-post-'));
  fs.mkdirSync(path.join(root, 'custom'), { recursive: true });
  // Action whose completion event is `bar_done` — establishes bar_done as a
  // NON-orphan event for the orphan-check.
  fs.writeFileSync(path.join(root, 'action.foo.md'),
    '---\nkind: action\nname: foo\ntitle: Foo\ndescription: Run foo.\ncategory: agent-spawn\ncompletion_event: bar_done\n---\n\nfoo body.\n');
  fs.writeFileSync(path.join(root, 'event.bar_done.md'),
    '---\nkind: event\nname: bar_done\ntitle: Bar Done\ndescription: bar done signal.\nsignal_payload: {}\n---\n\nbar done event body.\n');
  // Orphan event — no action references it as completion_event.
  fs.writeFileSync(path.join(root, 'event.kickoff.md'),
    '---\nkind: event\nname: kickoff\ntitle: Kickoff\ndescription: kickoff signal.\nsignal_payload: {}\n---\n\nkickoff event body.\n');
  __setActionEventsRootForTests(root);
  cleanups.push(() => {
    __setActionEventsRootForTests(null);
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

describe('isOrphanEvent', () => {
  it('returns true for an event no action declares as completion_event', () => {
    seedRoot();
    expect(isOrphanEvent('kickoff')).toBe(true);
  });

  it('returns false for an event that IS some action\'s completion_event', () => {
    seedRoot();
    expect(isOrphanEvent('bar_done')).toBe(false);
  });

  it('returns true when the catalog root does not exist (no actions = nothing claims the event)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-orphan-empty-'));
    fs.rmSync(tmp, { recursive: true, force: true });
    __setActionEventsRootForTests(tmp);
    cleanups.push(() => { __setActionEventsRootForTests(null); });
    expect(isOrphanEvent('anything')).toBe(true);
  });
});

describe('readOrphanPostContent', () => {
  it('returns trimmed content when the post custom file exists and is non-empty', () => {
    const root = seedRoot();
    fs.writeFileSync(path.join(root, 'custom', 'event.kickoff.post.md'), '  hello kickoff\n\n');
    expect(readOrphanPostContent('kickoff')).toBe('hello kickoff');
  });

  it('returns null when the post custom file does not exist', () => {
    seedRoot();
    expect(readOrphanPostContent('kickoff')).toBeNull();
  });

  it('returns null when the post custom file exists but is empty after trim', () => {
    const root = seedRoot();
    fs.writeFileSync(path.join(root, 'custom', 'event.kickoff.post.md'), '   \n\n  ');
    expect(readOrphanPostContent('kickoff')).toBeNull();
  });
});

describe('attachPromptIfActionResolved — orphan event post injection', () => {
  // The template arg is unused by resolveCompletionEvent (it cold-reads frontmatter).
  const dummyTemplate = {} as unknown as PipelineTemplate;

  it('prepends event.<orphan>.post content when firing event is orphan', () => {
    const root = seedRoot();
    fs.writeFileSync(path.join(root, 'custom', 'event.kickoff.post.md'), 'rant about starting before you start');
    const result = attachPromptIfActionResolved(
      { action: 'foo', context: {} },
      dummyTemplate,
      'kickoff',
    );
    expect(result.action).toBe('foo');
    expect(result.completion_event).toBe('bar_done');
    // Orphan post content is prepended before the action's own sections.
    // (P01-T02 will add proper Step-N heading to the prepended orphan section.)
    expect(result.prompt as string).toMatch(/rant about starting before you start/);
    // The action's own body still follows the prepended preamble.
    expect(result.prompt).toMatch(/foo body\./);
    expect(result.prompt).toMatch(/bar done event body\./);
  });

  it('does NOT prepend event.X.post when firing event X is non-orphan (avoids double-include)', () => {
    const root = seedRoot();
    // Author both an event.bar_done.post.md (which composer ALREADY includes via
    // the action's post slot) AND verify the engine does not also prepend it.
    fs.writeFileSync(path.join(root, 'custom', 'event.bar_done.post.md'), 'bar_done aftermath');
    const result = attachPromptIfActionResolved(
      { action: 'foo', context: {} },
      dummyTemplate,
      'bar_done',
    );
    expect(result.prompt).toBeDefined();
    // The composed action prompt includes bar_done aftermath exactly once (from the
    // composer's post-event slot), not prepended again at the top.
    const matches = (result.prompt as string).match(/bar_done aftermath/g) ?? [];
    expect(matches.length).toBe(1);
    // The prompt starts with the action body section (## Step 1).
    expect(result.prompt as string).toMatch(/^## Step 1/);
  });

  it('does NOT prepend when the orphan event has no post custom on disk', () => {
    seedRoot();
    const result = attachPromptIfActionResolved(
      { action: 'foo', context: {} },
      dummyTemplate,
      'kickoff',
    );
    expect(result.prompt).toBeDefined();
    expect(result.prompt as string).not.toMatch(/^## After signaling/);
  });

  it('returns the empty-action envelope when next is null (no spurious prepend)', () => {
    seedRoot();
    const result = attachPromptIfActionResolved(null, dummyTemplate, 'kickoff');
    expect(result).toEqual({ action: null, context: {} });
  });
});
