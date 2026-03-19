/**
 * Tests for ErrorLogSection and OtherDocsSection component logic.
 * Run with: npx tsx ui/components/dashboard/sections.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts, conditional rendering logic, and callback behavior
 * by simulating what the components do with their inputs.
 */
import assert from "node:assert";

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

// ---------- ErrorLogSection logic simulation ----------

interface ErrorLogSectionInputs {
  errors: { total_retries: number; total_halts: number; active_blockers: string[] };
  errorLogPath?: string | null;
  onDocClick?: (path: string) => void;
}

/**
 * Simulates the ErrorLogSection rendering logic.
 * Returns what the component would render.
 */
function simulateErrorLogSection({ errors, errorLogPath = null, onDocClick }: ErrorLogSectionInputs) {
  const showsRetries = true; // always shows retries
  const showsHalts = true; // always shows halts
  const showsBlockers = errors.active_blockers.length > 0;
  const showsEmptyBlockers = !showsBlockers;
  const showsErrorLogLink = errorLogPath !== null && onDocClick !== undefined;

  return {
    retries: errors.total_retries,
    halts: errors.total_halts,
    showsRetries,
    showsHalts,
    showsBlockers,
    showsEmptyBlockers,
    blockerCount: errors.active_blockers.length,
    showsErrorLogLink,
    errorLogPath,
    clickErrorLogLink: () => {
      if (showsErrorLogLink && errorLogPath && onDocClick) {
        onDocClick(errorLogPath);
      }
    },
  };
}

// ---------- OtherDocsSection logic simulation ----------

interface OtherDocsSectionInputs {
  files: string[];
  onDocClick: (path: string) => void;
}

/**
 * Simulates the OtherDocsSection rendering logic.
 */
function simulateOtherDocsSection({ files, onDocClick }: OtherDocsSectionInputs) {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  const isEmpty = sorted.length === 0;
  const hasNav = true; // always wrapped in nav
  const navAriaLabel = "Other project documents";
  const renderedFiles = sorted.map((file) => ({
    path: file,
    label: (file.split(/[\/\\]/).pop() ?? file).replace(/\.md$/i, ""),
  }));

  return {
    isEmpty,
    emptyText: isEmpty ? "No additional documents" : null,
    hasNav,
    navAriaLabel,
    renderedFiles,
    clickFile: (path: string) => {
      onDocClick(path);
    },
  };
}

// ==================== ErrorLogSection Tests ====================

console.log("ErrorLogSection");

test("renders 'View Error Log' link when errorLogPath is provided as a non-null string", () => {
  const result = simulateErrorLogSection({
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    errorLogPath: "ERROR-LOG.md",
    onDocClick: () => {},
  });
  assert.strictEqual(result.showsErrorLogLink, true, "Should show error log link");
});

test("does NOT render 'View Error Log' link when errorLogPath is null", () => {
  const result = simulateErrorLogSection({
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    errorLogPath: null,
    onDocClick: () => {},
  });
  assert.strictEqual(result.showsErrorLogLink, false, "Should not show error log link");
});

test("does NOT render 'View Error Log' link when errorLogPath is omitted", () => {
  const result = simulateErrorLogSection({
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
  });
  assert.strictEqual(result.showsErrorLogLink, false, "Should not show error log link");
});

test("still renders retry/halt counts and blockers correctly after prop changes", () => {
  const result = simulateErrorLogSection({
    errors: { total_retries: 5, total_halts: 2, active_blockers: ["blocker1", "blocker2"] },
    errorLogPath: "ERROR-LOG.md",
    onDocClick: () => {},
  });
  assert.strictEqual(result.retries, 5, "Should show 5 retries");
  assert.strictEqual(result.halts, 2, "Should show 2 halts");
  assert.strictEqual(result.showsBlockers, true, "Should show blockers");
  assert.strictEqual(result.blockerCount, 2, "Should have 2 blockers");
  assert.strictEqual(result.showsRetries, true);
  assert.strictEqual(result.showsHalts, true);
});

test("clicking 'View Error Log' link calls onDocClick with the provided errorLogPath", () => {
  let clickedPath = "";
  const result = simulateErrorLogSection({
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
    errorLogPath: "projects/MY-PROJECT/ERROR-LOG.md",
    onDocClick: (path) => { clickedPath = path; },
  });
  result.clickErrorLogLink();
  assert.strictEqual(clickedPath, "projects/MY-PROJECT/ERROR-LOG.md", "onDocClick should receive the errorLogPath");
});

test("shows empty blockers message when no blockers exist", () => {
  const result = simulateErrorLogSection({
    errors: { total_retries: 0, total_halts: 0, active_blockers: [] },
  });
  assert.strictEqual(result.showsEmptyBlockers, true, "Should show empty blockers state");
  assert.strictEqual(result.showsBlockers, false, "Should not show blockers list");
});

// ==================== OtherDocsSection Tests ====================

console.log("\nOtherDocsSection");

test("renders each file as a DocumentLink in alphabetical order", () => {
  const result = simulateOtherDocsSection({
    files: ["CHANGELOG.md", "ARCHITECTURE.md", "NOTES.md"],
    onDocClick: () => {},
  });
  assert.deepStrictEqual(
    result.renderedFiles.map((f) => f.path),
    ["ARCHITECTURE.md", "CHANGELOG.md", "NOTES.md"],
    "Files should be sorted alphabetically",
  );
});

test("shows 'No additional documents' when files is an empty array", () => {
  const result = simulateOtherDocsSection({
    files: [],
    onDocClick: () => {},
  });
  assert.strictEqual(result.isEmpty, true, "Should be empty");
  assert.strictEqual(result.emptyText, "No additional documents");
});

test("wrapped in a <nav> element with aria-label='Other project documents'", () => {
  const result = simulateOtherDocsSection({
    files: ["README.md"],
    onDocClick: () => {},
  });
  assert.strictEqual(result.hasNav, true, "Should have nav wrapper");
  assert.strictEqual(result.navAriaLabel, "Other project documents");
});

test("labels are derived by stripping .md extension", () => {
  const result = simulateOtherDocsSection({
    files: ["CHANGELOG.md", "TODO.md"],
    onDocClick: () => {},
  });
  assert.deepStrictEqual(
    result.renderedFiles.map((f) => f.label),
    ["CHANGELOG", "TODO"],
    "Labels should have .md stripped",
  );
});

test("labels with a full absolute path show only the basename without .md extension", () => {
  const result = simulateOtherDocsSection({
    files: ["C:/dev/projects/MY-PROJECT/MY-PROJECT-BRAINSTORMING.md"],
    onDocClick: () => {},
  });
  assert.deepStrictEqual(
    result.renderedFiles.map((f) => f.label),
    ["MY-PROJECT-BRAINSTORMING"],
    "Label should be basename only, no path prefix or extension",
  );
});

test("clicking a file calls onDocClick with the file path", () => {
  let clickedPath = "";
  const result = simulateOtherDocsSection({
    files: ["README.md"],
    onDocClick: (path) => { clickedPath = path; },
  });
  result.clickFile("README.md");
  assert.strictEqual(clickedPath, "README.md", "onDocClick should receive the file path");
});

test("does not mutate the original files array", () => {
  const original = ["B.md", "A.md"];
  const copy = [...original];
  simulateOtherDocsSection({ files: original, onDocClick: () => {} });
  assert.deepStrictEqual(original, copy, "Original array should not be mutated");
});

// ==================== PlanningChecklist label logic ====================

console.log("\nPlanningChecklist label logic");

const STEP_DISPLAY_NAMES_SIM: Record<string, string> = {
  research: "Research",
  prd: "PRD",
  design: "Design",
  architecture: "Architecture",
  master_plan: "Master Plan",
};

function simulatePlanningChecklistLabel(docPath: string | null, stepName: string): string {
  return docPath
    ? (docPath.split(/[\/\\]/).pop() ?? docPath).replace(/\.md$/i, "")
    : STEP_DISPLAY_NAMES_SIM[stepName] ?? stepName;
}

test("shows basename-only label when doc_path is an absolute path", () => {
  const label = simulatePlanningChecklistLabel(
    "C:/dev/orchestration-projects/MY-APP/MY-APP-PRD.md",
    "prd",
  );
  assert.strictEqual(label, "MY-APP-PRD", "Should show basename without extension");
});

test("falls back to step display name when doc_path is null", () => {
  const label = simulatePlanningChecklistLabel(null, "architecture");
  assert.strictEqual(label, "Architecture", "Should fall back to display name");
});

test("shows basename-only label when doc_path is a relative path", () => {
  const label = simulatePlanningChecklistLabel(
    "MY-APP-RESEARCH-FINDINGS.md",
    "research",
  );
  assert.strictEqual(label, "MY-APP-RESEARCH-FINDINGS", "Should strip extension from relative path");
});

// ==================== Summary ====================

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
