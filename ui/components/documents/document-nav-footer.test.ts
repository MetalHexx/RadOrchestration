/**
 * Tests for DocumentNavFooter component logic.
 * Run with: npx tsx ui/components/documents/document-nav-footer.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * navigation logic the component relies on (getAdjacentDocs) combined
 * with the disable/enable and callback guard logic.
 */
import assert from "node:assert";
import { getAdjacentDocs } from "../../lib/document-ordering";
import type { OrderedDoc } from "../../types/components";

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

const threeDocs: OrderedDoc[] = [
  { path: "docs/RESEARCH.md", title: "Research", category: "planning" },
  { path: "docs/PRD.md", title: "PRD", category: "planning" },
  { path: "docs/DESIGN.md", title: "Design", category: "planning" },
];

const oneDoc: OrderedDoc[] = [
  { path: "docs/RESEARCH.md", title: "Research", category: "planning" },
];

// Simulates the component's disable/navigate logic
function simulateFooter(
  docs: OrderedDoc[],
  currentPath: string,
  onNavigate: (path: string) => void,
) {
  const { prev, next, currentIndex, total } = getAdjacentDocs(docs, currentPath);
  const prevDisabled = prev === null;
  const nextDisabled = next === null;

  return {
    prev,
    next,
    prevDisabled,
    nextDisabled,
    currentIndex,
    total,
    clickPrev: () => {
      if (!prevDisabled && prev) onNavigate(prev.path);
    },
    clickNext: () => {
      if (!nextDisabled && next) onNavigate(next.path);
    },
    prevAriaLabel: prev
      ? `Previous document: ${prev.title}`
      : "No previous document",
    nextAriaLabel: next ? `Next document: ${next.title}` : "No next document",
  };
}

console.log("DocumentNavFooter logic");

test("renders Prev and Next buttons when positioned in the middle", () => {
  const footer = simulateFooter(threeDocs, "docs/PRD.md", () => {});
  assert.ok(!footer.prevDisabled, "Prev should be enabled");
  assert.ok(!footer.nextDisabled, "Next should be enabled");
  assert.strictEqual(footer.prev?.title, "Research");
  assert.strictEqual(footer.next?.title, "Design");
});

test("Prev button is disabled when currentPath is the first doc", () => {
  const footer = simulateFooter(threeDocs, "docs/RESEARCH.md", () => {});
  assert.ok(footer.prevDisabled, "Prev should be disabled at first doc");
  assert.ok(!footer.nextDisabled, "Next should be enabled");
});

test("Next button is disabled when currentPath is the last doc", () => {
  const footer = simulateFooter(threeDocs, "docs/DESIGN.md", () => {});
  assert.ok(!footer.prevDisabled, "Prev should be enabled");
  assert.ok(footer.nextDisabled, "Next should be disabled at last doc");
});

test("Both buttons disabled when only one document in the list", () => {
  const footer = simulateFooter(oneDoc, "docs/RESEARCH.md", () => {});
  assert.ok(footer.prevDisabled, "Prev should be disabled");
  assert.ok(footer.nextDisabled, "Next should be disabled");
});

test("Clicking an active Next button calls onNavigate with the next doc path", () => {
  let navigatedTo = "";
  const footer = simulateFooter(threeDocs, "docs/PRD.md", (path) => {
    navigatedTo = path;
  });
  footer.clickNext();
  assert.strictEqual(navigatedTo, "docs/DESIGN.md");
});

test("Clicking an active Prev button calls onNavigate with the prev doc path", () => {
  let navigatedTo = "";
  const footer = simulateFooter(threeDocs, "docs/PRD.md", (path) => {
    navigatedTo = path;
  });
  footer.clickPrev();
  assert.strictEqual(navigatedTo, "docs/RESEARCH.md");
});

test("Clicking a disabled button does NOT call onNavigate", () => {
  let called = false;
  const footer = simulateFooter(threeDocs, "docs/RESEARCH.md", () => {
    called = true;
  });
  footer.clickPrev();
  assert.ok(!called, "onNavigate should not have been called");
});

test("aria-label on Prev contains the previous document title", () => {
  const footer = simulateFooter(threeDocs, "docs/PRD.md", () => {});
  assert.ok(
    footer.prevAriaLabel.includes("Research"),
    `Expected "Research" in "${footer.prevAriaLabel}"`,
  );
});

test("aria-label on Next contains the next document title", () => {
  const footer = simulateFooter(threeDocs, "docs/PRD.md", () => {});
  assert.ok(
    footer.nextAriaLabel.includes("Design"),
    `Expected "Design" in "${footer.nextAriaLabel}"`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
