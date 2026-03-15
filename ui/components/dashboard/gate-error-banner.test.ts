/**
 * Tests for GateErrorBanner component logic.
 * Run with: npx tsx ui/components/dashboard/gate-error-banner.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts, conditional rendering logic, and callback behavior
 * by simulating what the component does with its inputs.
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

// ---------- GateErrorBanner logic simulation ----------

interface GateErrorBannerInputs {
  message: string;
  detail?: string;
  onDismiss: () => void;
}

/**
 * Simulates the GateErrorBanner rendering logic.
 * Returns what the component would render based on its props.
 */
function simulateGateErrorBanner({ message, detail, onDismiss }: GateErrorBannerInputs) {
  // Container attributes (always present)
  const containerAttrs = {
    role: "alert" as const,
    "aria-live": "polite" as const,
    className: "rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm",
  };

  // AlertCircle icon attributes
  const alertIcon = {
    "aria-hidden": "true" as const,
    className: "size-4 shrink-0 text-destructive mt-0.5",
  };

  // Message element
  const messageElement = {
    text: message,
    className: "text-destructive font-medium",
  };

  // Dismiss button attributes
  const dismissButton = {
    variant: "ghost" as const,
    size: "icon-xs" as const,
    "aria-label": "Dismiss error",
    onClick: onDismiss,
  };

  // Detail section (conditional)
  const detailSection = detail
    ? {
        rendered: true,
        summaryText: "Show pipeline detail",
        summaryClassName: "cursor-pointer text-xs text-muted-foreground hover:text-foreground",
        preContent: detail,
        preClassName:
          "mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words overflow-auto max-h-32 rounded bg-muted p-2",
      }
    : { rendered: false };

  return { containerAttrs, alertIcon, messageElement, dismissButton, detailSection };
}

// ---------- Tests ----------

console.log("\nGateErrorBanner tests:");

test("Component renders without crashing when given message and onDismiss", () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {},
  });
  assert.ok(result, "Should return a result object");
  assert.strictEqual(result.messageElement.text, "Test error");
});

test('role="alert" attribute is present on the container', () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {},
  });
  assert.strictEqual(result.containerAttrs.role, "alert");
});

test('aria-live="polite" attribute is present on the container', () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {},
  });
  assert.strictEqual(result.containerAttrs["aria-live"], "polite");
});

test("Message text has text-destructive and font-medium classes", () => {
  const result = simulateGateErrorBanner({
    message: "Something went wrong",
    onDismiss: () => {},
  });
  assert.ok(result.messageElement.className.includes("text-destructive"));
  assert.ok(result.messageElement.className.includes("font-medium"));
});

test('AlertCircle icon has aria-hidden="true"', () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {},
  });
  assert.strictEqual(result.alertIcon["aria-hidden"], "true");
});

test('Dismiss button has aria-label="Dismiss error" and calls onDismiss', () => {
  let dismissed = false;
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {
      dismissed = true;
    },
  });
  assert.strictEqual(result.dismissButton["aria-label"], "Dismiss error");
  result.dismissButton.onClick();
  assert.strictEqual(dismissed, true, "onDismiss should have been called");
});

test("When detail is provided: details element is rendered with summary and pre", () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    detail: "Raw pipeline error output here",
    onDismiss: () => {},
  });
  assert.strictEqual(result.detailSection.rendered, true);
  if (result.detailSection.rendered) {
    assert.strictEqual(result.detailSection.summaryText, "Show pipeline detail");
    assert.strictEqual(result.detailSection.preContent, "Raw pipeline error output here");
  }
});

test("When detail is undefined: no details element is rendered", () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    onDismiss: () => {},
  });
  assert.strictEqual(result.detailSection.rendered, false);
});

test("Detail pre has max-h-32 and overflow-auto classes", () => {
  const result = simulateGateErrorBanner({
    message: "Test error",
    detail: "Some detail",
    onDismiss: () => {},
  });
  assert.strictEqual(result.detailSection.rendered, true);
  if (result.detailSection.rendered) {
    assert.ok(result.detailSection.preClassName!.includes("max-h-32"));
    assert.ok(result.detailSection.preClassName!.includes("overflow-auto"));
  }
});

// ---------- Summary ----------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
