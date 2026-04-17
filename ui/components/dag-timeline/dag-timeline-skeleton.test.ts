/**
 * Tests for DAGTimelineSkeleton component logic.
 * Run with: npx tsx --tsconfig ui/tsconfig.test.json ui/components/dag-timeline/dag-timeline-skeleton.test.ts
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DAGTimelineSkeleton } from './dag-timeline-skeleton';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const skeletonSource = readFileSync(join(__dirname, 'dag-timeline-skeleton.tsx'), 'utf-8');
const barrelSource = readFileSync(join(__dirname, 'index.ts'), 'utf-8');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}\n    ${msg}`);
    failed++;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the children array of a React element's props, flattening any
 * nested arrays one level deep (React renders array children inline so they
 * appear as direct siblings in the DOM, but in the element tree they may be
 * represented as a nested array — e.g. when `{rows}` is an array expression
 * in JSX, React stores `[sectionLabel, [row0, row1, ...]]`).
 */
function getChildren(element: { props?: { children?: unknown } }): unknown[] {
  const children = element?.props?.children;
  if (children === undefined || children === null) return [];
  const raw = Array.isArray(children) ? (children as unknown[]) : [children];
  // Flatten one level: React may pack array expressions as nested arrays
  const flat: unknown[] = [];
  for (const child of raw) {
    if (Array.isArray(child)) {
      for (const grandchild of child as unknown[]) {
        flat.push(grandchild);
      }
    } else {
      flat.push(child);
    }
  }
  return flat;
}

/**
 * Counts children whose className includes "flex items-center gap-3"
 * (the row-shaped placeholder shape defined in the implementation).
 */
function countRowPlaceholders(children: unknown[]): number {
  return children.filter(
    (child) =>
      typeof child === 'object' &&
      child !== null &&
      typeof (child as { props?: { className?: unknown } }).props?.className === 'string' &&
      (child as { props: { className: string } }).props.className.includes('flex items-center gap-3')
  ).length;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

console.log("\nDAGTimelineSkeleton component tests\n");

// ─── ARIA attributes ──────────────────────────────────────────────────────────

test('DAGTimelineSkeleton() outer element carries role="status"', () => {
  const element = DAGTimelineSkeleton();
  assert.strictEqual((element as unknown as { props: Record<string, unknown> }).props.role, 'status');
});

test('DAGTimelineSkeleton() outer element carries aria-label="Loading timeline"', () => {
  const element = DAGTimelineSkeleton();
  assert.strictEqual(
    (element as unknown as { props: Record<string, unknown> }).props['aria-label'],
    'Loading timeline',
  );
});

// ─── Default rowCount (6) ─────────────────────────────────────────────────────

test('DAGTimelineSkeleton() (no props) returns a React element', () => {
  const element = DAGTimelineSkeleton();
  assert.ok(element !== null && typeof element === 'object', 'should return a non-null object');
  assert.ok('props' in element, 'returned object should have a props property');
});

test('DAGTimelineSkeleton() children include the section-label bar', () => {
  const element = DAGTimelineSkeleton();
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  // First child is the section-label Skeleton
  assert.ok(children.length >= 1, 'should have at least one child (section-label bar)');
  const firstChild = children[0] as { props?: { className?: string } } | undefined;
  assert.ok(
    typeof firstChild?.props?.className === 'string' &&
    firstChild.props.className.includes('h-4') &&
    firstChild.props.className.includes('w-32'),
    'first child should be the h-4 w-32 section-label bar',
  );
});

test('DAGTimelineSkeleton() (default rowCount=6) returns exactly 6 row-shaped placeholders', () => {
  const element = DAGTimelineSkeleton();
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const rowCount = countRowPlaceholders(children);
  assert.strictEqual(rowCount, 6, `expected 6 row placeholders, got ${rowCount}`);
});

test('DAGTimelineSkeleton({ rowCount: 6 }) returns exactly 6 row-shaped placeholders', () => {
  const element = DAGTimelineSkeleton({ rowCount: 6 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const rowCount = countRowPlaceholders(children);
  assert.strictEqual(rowCount, 6, `expected 6 row placeholders, got ${rowCount}`);
});

// ─── rowCount: 0 ─────────────────────────────────────────────────────────────

test('DAGTimelineSkeleton({ rowCount: 0 }) returns zero row-shaped placeholders', () => {
  const element = DAGTimelineSkeleton({ rowCount: 0 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const rowCount = countRowPlaceholders(children);
  assert.strictEqual(rowCount, 0, `expected 0 row placeholders, got ${rowCount}`);
});

test('DAGTimelineSkeleton({ rowCount: 0 }) still renders the section-label bar', () => {
  const element = DAGTimelineSkeleton({ rowCount: 0 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  assert.ok(children.length >= 1, 'should have at least one child (section-label bar)');
  const firstChild = children[0] as { props?: { className?: string } } | undefined;
  assert.ok(
    typeof firstChild?.props?.className === 'string' &&
    firstChild.props.className.includes('h-4') &&
    firstChild.props.className.includes('w-32'),
    'first child should be the h-4 w-32 section-label bar',
  );
});

test('DAGTimelineSkeleton({ rowCount: 0 }) outer element still carries role="status"', () => {
  const element = DAGTimelineSkeleton({ rowCount: 0 });
  assert.strictEqual(
    (element as unknown as { props: Record<string, unknown> }).props.role,
    'status',
  );
});

// ─── rowCount: 3 ─────────────────────────────────────────────────────────────

test('DAGTimelineSkeleton({ rowCount: 3 }) returns exactly 3 row-shaped placeholders', () => {
  const element = DAGTimelineSkeleton({ rowCount: 3 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const rowCount = countRowPlaceholders(children);
  assert.strictEqual(rowCount, 3, `expected 3 row placeholders, got ${rowCount}`);
});

test('DAGTimelineSkeleton({ rowCount: 3 }) also renders the section-label bar', () => {
  const element = DAGTimelineSkeleton({ rowCount: 3 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const firstChild = children[0] as { props?: { className?: string } } | undefined;
  assert.ok(
    typeof firstChild?.props?.className === 'string' &&
    firstChild.props.className.includes('h-4') &&
    firstChild.props.className.includes('w-32'),
    'first child should be the h-4 w-32 section-label bar',
  );
});

test('DAGTimelineSkeleton({ rowCount: 3 }) includes 1 loop-shaped placeholder (interleaved after row index 1)', () => {
  const element = DAGTimelineSkeleton({ rowCount: 3 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  // Loop placeholders have className including "h-6" and "w-full" and "max-w-[60%]"
  const loopCount = children.filter(
    (child) =>
      typeof child === 'object' &&
      child !== null &&
      typeof (child as { props?: { className?: unknown } }).props?.className === 'string' &&
      (child as { props: { className: string } }).props.className.includes('h-6') &&
      (child as { props: { className: string } }).props.className.includes('w-full')
  ).length;
  assert.strictEqual(loopCount, 1, `expected 1 loop placeholder for rowCount=3, got ${loopCount}`);
});

// ─── rowCount: 6 — loop placeholders ─────────────────────────────────────────

test('DAGTimelineSkeleton({ rowCount: 6 }) includes 2 loop-shaped placeholders (after rows 1 and 3)', () => {
  const element = DAGTimelineSkeleton({ rowCount: 6 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  const loopCount = children.filter(
    (child) =>
      typeof child === 'object' &&
      child !== null &&
      typeof (child as { props?: { className?: unknown } }).props?.className === 'string' &&
      (child as { props: { className: string } }).props.className.includes('h-6') &&
      (child as { props: { className: string } }).props.className.includes('w-full')
  ).length;
  assert.strictEqual(loopCount, 2, `expected 2 loop placeholders for rowCount=6, got ${loopCount}`);
});

test('DAGTimelineSkeleton({ rowCount: 6 }) total children = 1 (section-label) + 6 (rows) + 2 (loops) = 9', () => {
  const element = DAGTimelineSkeleton({ rowCount: 6 });
  const children = getChildren(element as unknown as { props?: { children?: unknown } });
  assert.strictEqual(children.length, 9, `expected 9 total children, got ${children.length}`);
});

// ─── Source-text: composition constraints ────────────────────────────────────

test('dag-timeline-skeleton.tsx imports Skeleton from @/components/ui/skeleton', () => {
  assert.ok(
    skeletonSource.includes("from '@/components/ui/skeleton'"),
    'must import Skeleton from @/components/ui/skeleton',
  );
});

test('dag-timeline-skeleton.tsx does NOT import any hooks (no useSSEContext, useProjects, etc.)', () => {
  assert.ok(
    !skeletonSource.includes('useSSEContext'),
    'must not import useSSEContext',
  );
  assert.ok(
    !skeletonSource.includes('useProjects'),
    'must not import useProjects',
  );
  assert.ok(
    !skeletonSource.includes('useState'),
    'must not use useState',
  );
  assert.ok(
    !skeletonSource.includes('useEffect'),
    'must not use useEffect',
  );
  assert.ok(
    !skeletonSource.includes('useRef'),
    'must not use useRef',
  );
});

test('dag-timeline-skeleton.tsx outer wrapper uses role="status"', () => {
  assert.ok(
    skeletonSource.includes('role="status"'),
    'outer wrapper must carry role="status"',
  );
});

test('dag-timeline-skeleton.tsx outer wrapper uses aria-label="Loading timeline"', () => {
  assert.ok(
    skeletonSource.includes('aria-label="Loading timeline"'),
    'outer wrapper must carry aria-label="Loading timeline"',
  );
});

test('dag-timeline-skeleton.tsx does NOT use role="alert" or aria-live="assertive"', () => {
  assert.ok(
    !skeletonSource.includes('role="alert"'),
    'must not use role="alert"',
  );
  assert.ok(
    !skeletonSource.includes('aria-live="assertive"'),
    'must not use aria-live="assertive"',
  );
});

// ─── Barrel exports ───────────────────────────────────────────────────────────

test('index.ts exports DAGTimelineSkeleton', () => {
  assert.ok(
    barrelSource.includes('DAGTimelineSkeleton'),
    'index.ts must export DAGTimelineSkeleton',
  );
});

test('index.ts exports DAGTimelineSkeletonProps', () => {
  assert.ok(
    barrelSource.includes('DAGTimelineSkeletonProps'),
    'index.ts must export DAGTimelineSkeletonProps',
  );
});

test('index.ts places DAGTimelineSkeleton export adjacent to HaltReasonBanner export', () => {
  const haltIdx = barrelSource.indexOf('HaltReasonBanner');
  const skeletonIdx = barrelSource.indexOf('DAGTimelineSkeleton');
  assert.ok(haltIdx !== -1, 'HaltReasonBanner must exist in index.ts');
  assert.ok(skeletonIdx !== -1, 'DAGTimelineSkeleton must exist in index.ts');
  // Skeleton should appear within 200 characters of HaltReasonBanner in source
  assert.ok(
    Math.abs(haltIdx - skeletonIdx) < 200,
    `DAGTimelineSkeleton (${skeletonIdx}) should be near HaltReasonBanner (${haltIdx}) in index.ts`,
  );
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
