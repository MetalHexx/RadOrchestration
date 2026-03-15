// sample-apps/rainbow-hello/test/animator.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { animateReveal } from '../src/animator.js';

describe('animateReveal', () => {

  describe('export & type', () => {
    it('is exported and typeof is function', () => {
      assert.equal(typeof animateReveal, 'function');
    });

    it('is an AsyncFunction', () => {
      assert.equal(animateReveal.constructor.name, 'AsyncFunction');
    });
  });

  describe('stdout output', () => {
    // Run animateReveal() once with mocked stdout and validate all output properties.
    // A single invocation avoids repeating the ~1.6s animation for every assertion.
    it('produces correct ANSI output and resolves to undefined', async (t) => {
      const chunks = [];
      t.mock.method(process.stdout, 'write', (chunk) => {
        chunks.push(String(chunk));
        return true;
      });

      const start = Date.now();
      const result = await animateReveal();
      const elapsed = Date.now() - start;

      t.mock.restoreAll();

      const output = chunks.join('');

      // Promise resolution
      assert.equal(result, undefined, 'animateReveal() should resolve to undefined');

      // Cursor hide / show
      assert.ok(output.includes('\x1b[?25l'), 'output contains hide-cursor sequence');
      assert.ok(output.includes('\x1b[?25h'), 'output contains show-cursor sequence');

      const hideIndex = output.indexOf('\x1b[?25l');
      const showIndex = output.indexOf('\x1b[?25h');
      assert.ok(hideIndex < showIndex, 'hide-cursor appears before show-cursor');

      // Cursor save / restore
      assert.ok(output.includes('\x1b7'), 'output contains cursor save sequence');
      assert.ok(output.includes('\x1b8'), 'output contains cursor restore sequence');

      // Cursor movement
      assert.ok(/\x1b\[\d+B/.test(output), 'output contains cursor-down sequences');
      assert.ok(/\x1b\[\d+C/.test(output), 'output contains cursor-right sequences');

      // ANSI RGB colour codes
      assert.ok(output.includes('\x1b[38;2;'), 'output contains ANSI RGB color codes');

      // Block characters
      assert.ok(output.includes('█'), 'output contains block characters');

      // Timing
      assert.ok(elapsed > 500, `animation took non-trivial time (${elapsed}ms > 500ms)`);
    });
  });

  describe('SIGINT cleanup', () => {
    it('listener count is the same before and after', async (t) => {
      t.mock.method(process.stdout, 'write', () => true);

      const before = process.listenerCount('SIGINT');
      await animateReveal();
      const after = process.listenerCount('SIGINT');

      t.mock.restoreAll();
      assert.equal(before, after, 'SIGINT listener was cleaned up');
    });
  });
});
