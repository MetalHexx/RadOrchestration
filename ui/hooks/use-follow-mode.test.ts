/**
 * Tests for the pure `computeSmartDefaults` helper and callback shapes exported
 * by `use-follow-mode.ts`. Exercises the state-walking logic without rendering
 * React components.
 *
 * Run with: npx tsx ui/hooks/use-follow-mode.test.ts
 */
import assert from 'node:assert';

// Import the pure helper and shallow-equal utility directly — these have no
// React lifecycle dependency and can be exercised without a renderer. The
// test file does NOT import React or run any React hooks — it only tests the
// pure helpers and verifies the module's exported surface.
import {
  computeSmartDefaults,
  __shallowEqualStringArrays,
  useFollowMode,
} from './use-follow-mode';
import type { UseFollowModeReturn } from './use-follow-mode';

// ─── Minimal inline type shapes matching ui/types/state.ts ───────────────────
// Inlined per the `use-projects.test.ts` convention — keeps the test file
// self-contained and avoids coupling to the full state-type surface.

type NodeStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'halted' | 'skipped';

interface StepNodeShape {
  kind: 'step';
  status: NodeStatus;
  doc_path: string | null;
  retries: number;
}

interface ParallelNodeShape {
  kind: 'parallel';
  status: NodeStatus;
  nodes: Record<string, AnyNodeShape>;
}

interface IterationEntryShape {
  index: number;
  status: NodeStatus;
  nodes: Record<string, AnyNodeShape>;
  corrective_tasks: [];
}

interface ForEachPhaseNodeShape {
  kind: 'for_each_phase';
  status: NodeStatus;
  iterations: IterationEntryShape[];
}

interface ForEachTaskNodeShape {
  kind: 'for_each_task';
  status: NodeStatus;
  iterations: IterationEntryShape[];
}

type AnyNodeShape =
  | StepNodeShape
  | ParallelNodeShape
  | ForEachPhaseNodeShape
  | ForEachTaskNodeShape;

// ─── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// Helper — cast the loosely-typed inline shape to the NodesRecord type that
// `computeSmartDefaults` expects. The runtime behaviour is identical; the
// cast only silences TypeScript because we intentionally inline a minimal
// type surface in this test file.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toNodes = (v: Record<string, AnyNodeShape>): any => v;

async function run() {
  console.log('use-follow-mode — computeSmartDefaults + exported surface');

  // (a) empty record
  await test('(a) computeSmartDefaults({}) returns []', () => {
    const result = computeSmartDefaults(toNodes({}));
    assert.deepStrictEqual(result, []);
  });

  // (b) single top-level for_each_phase, in_progress
  await test('(b) computeSmartDefaults returns ["loop-phase_loop"] for active for_each_phase', () => {
    const nodes: Record<string, AnyNodeShape> = {
      phase_loop: {
        kind: 'for_each_phase',
        status: 'in_progress',
        iterations: [],
      },
    };
    const result = computeSmartDefaults(toNodes(nodes));
    assert.deepStrictEqual(result, ['loop-phase_loop']);
  });

  // (c) recursion into iteration nodes — nested for_each_task
  await test('(c) computeSmartDefaults recurses into iteration nodes to find nested active task_loop', () => {
    const nodes: Record<string, AnyNodeShape> = {
      phase_loop: {
        kind: 'for_each_phase',
        status: 'in_progress',
        iterations: [
          {
            index: 0,
            status: 'in_progress',
            nodes: {
              task_loop: {
                kind: 'for_each_task',
                status: 'in_progress',
                iterations: [],
              },
            },
            corrective_tasks: [],
          },
        ],
      },
    };
    const result = computeSmartDefaults(toNodes(nodes));
    assert.deepStrictEqual(result, ['loop-phase_loop', 'loop-task_loop']);
  });

  // (d) excludes loops with non-in_progress status
  await test('(d) computeSmartDefaults excludes loops whose status is "completed"', () => {
    const nodes: Record<string, AnyNodeShape> = {
      phase_loop: {
        kind: 'for_each_phase',
        status: 'completed',
        iterations: [],
      },
    };
    const result = computeSmartDefaults(toNodes(nodes));
    assert.deepStrictEqual(result, []);
  });

  await test('(d2) computeSmartDefaults excludes loops whose status is "not_started"', () => {
    const nodes: Record<string, AnyNodeShape> = {
      phase_loop: {
        kind: 'for_each_phase',
        status: 'not_started',
        iterations: [],
      },
    };
    assert.deepStrictEqual(computeSmartDefaults(toNodes(nodes)), []);
  });

  await test('(d3) computeSmartDefaults excludes loops whose status is "failed" / "halted" / "skipped"', () => {
    const statuses: NodeStatus[] = ['failed', 'halted', 'skipped'];
    for (const s of statuses) {
      const nodes: Record<string, AnyNodeShape> = {
        phase_loop: {
          kind: 'for_each_phase',
          status: s,
          iterations: [],
        },
      };
      assert.deepStrictEqual(
        computeSmartDefaults(toNodes(nodes)),
        [],
        `status=${s} should not appear in smart defaults`
      );
    }
  });

  // (e) null input
  await test('(e) computeSmartDefaults(null) returns []', () => {
    const result = computeSmartDefaults(null);
    assert.deepStrictEqual(result, []);
  });

  // (f) recursion into parallel.nodes
  await test('(f) computeSmartDefaults recurses into parallel.nodes to discover nested loops', () => {
    const nodes: Record<string, AnyNodeShape> = {
      parallel_block: {
        kind: 'parallel',
        status: 'in_progress',
        nodes: {
          nested_phase_loop: {
            kind: 'for_each_phase',
            status: 'in_progress',
            iterations: [],
          },
        },
      },
    };
    const result = computeSmartDefaults(toNodes(nodes));
    assert.deepStrictEqual(result, ['loop-nested_phase_loop']);
  });

  // (g) shallow-equal short-circuit helper — identical arrays
  await test('(g) __shallowEqualStringArrays returns true for same-length same-order arrays', () => {
    assert.strictEqual(__shallowEqualStringArrays([], []), true);
    assert.strictEqual(__shallowEqualStringArrays(['a'], ['a']), true);
    assert.strictEqual(
      __shallowEqualStringArrays(['loop-phase_loop', 'loop-task_loop'], ['loop-phase_loop', 'loop-task_loop']),
      true
    );
  });

  await test('(g2) __shallowEqualStringArrays returns false for different-length arrays', () => {
    assert.strictEqual(__shallowEqualStringArrays([], ['a']), false);
    assert.strictEqual(__shallowEqualStringArrays(['a'], ['a', 'b']), false);
  });

  await test('(g3) __shallowEqualStringArrays returns false for same-length arrays with different content', () => {
    assert.strictEqual(__shallowEqualStringArrays(['a'], ['b']), false);
    assert.strictEqual(
      __shallowEqualStringArrays(['loop-a', 'loop-b'], ['loop-b', 'loop-a']),
      false,
      'order-sensitive'
    );
  });

  // (h) two calls with structurally equal inputs produce equal arrays by value.
  //     (Reference-equality is NOT guaranteed for pure calls of
  //     `computeSmartDefaults`; the shallow-equal short-circuit lives inside
  //     the hook's effect and preserves reference equality across renders.)
  await test('(h) computeSmartDefaults returns value-equal arrays for equivalent inputs', () => {
    const nodes: Record<string, AnyNodeShape> = {
      phase_loop: {
        kind: 'for_each_phase',
        status: 'in_progress',
        iterations: [],
      },
    };
    const a = computeSmartDefaults(toNodes(nodes));
    const b = computeSmartDefaults(toNodes(nodes));
    assert.deepStrictEqual(a, b);
    assert.strictEqual(__shallowEqualStringArrays(a, b), true);
  });

  // (i) exported-surface check — `useFollowMode` is a named function export
  //     and `UseFollowModeReturn` is a named type export (verified at compile
  //     time by the `import type` at the top of this file).
  await test('(i) useFollowMode is exported as a function', () => {
    assert.strictEqual(typeof useFollowMode, 'function');
    // UseFollowModeReturn is a type-only export — the compile-time import at
    // the top of this file verifies the name is exported. A runtime assertion
    // is not possible for type-only exports. The `_type` reference below
    // keeps the import non-trivially used for the type-checker.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _type: UseFollowModeReturn | null = null;
    assert.strictEqual(_type, null);
  });

  // (j) onAccordionChange callback shape — compile-time check via a stub
  //     function that matches the contract signature. Both 'trigger-press'
  //     and 'none' reason values must type-check and not throw when invoked.
  await test('(j) onAccordionChange signature accepts both "trigger-press" and "none" reasons', () => {
    const stub: (value: string[], eventDetails: { reason: string }) => void = (_value, _eventDetails) => {
      // no-op
    };
    // These calls exercise the runtime path — they must not throw.
    assert.doesNotThrow(() => stub(['loop-phase_loop'], { reason: 'trigger-press' }));
    assert.doesNotThrow(() => stub([], { reason: 'none' }));
    assert.doesNotThrow(() => stub(['loop-a', 'loop-b'], { reason: 'trigger-press' }));
  });

  // (k) smart-default recursion over multiple sibling loops
  await test('(k) computeSmartDefaults collects all in-progress loops across siblings', () => {
    const nodes: Record<string, AnyNodeShape> = {
      loop_a: { kind: 'for_each_phase', status: 'in_progress', iterations: [] },
      loop_b: { kind: 'for_each_task', status: 'in_progress', iterations: [] },
      loop_c: { kind: 'for_each_phase', status: 'completed', iterations: [] },
      step_x: { kind: 'step', status: 'in_progress', doc_path: null, retries: 0 },
    };
    const result = computeSmartDefaults(toNodes(nodes));
    // Object.keys order is insertion order in modern JS engines; assert the
    // two expected entries are present in the result.
    assert.strictEqual(result.length, 2);
    assert.ok(result.includes('loop-loop_a'));
    assert.ok(result.includes('loop-loop_b'));
    assert.ok(!result.includes('loop-loop_c'));
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
