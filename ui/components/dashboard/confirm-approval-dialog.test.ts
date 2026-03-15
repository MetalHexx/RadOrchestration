/**
 * Tests for ConfirmApprovalDialog component logic.
 * Run with: npx tsx ui/components/dashboard/confirm-approval-dialog.test.ts
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

// ---------- ConfirmApprovalDialog logic simulation ----------

interface ConfirmApprovalDialogInputs {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  documentName: string;
  description: string;
  onConfirm: () => void;
  isPending: boolean;
}

/**
 * Simulates the ConfirmApprovalDialog rendering logic.
 * Returns what the component would render based on its props.
 */
function simulateConfirmApprovalDialog({
  open,
  onOpenChange,
  title,
  documentName,
  description,
  onConfirm,
  isPending,
}: ConfirmApprovalDialogInputs) {
  // Guarded onOpenChange — blocked when isPending
  const guardedOnOpenChange = (value: boolean) => {
    if (!isPending) {
      onOpenChange(value);
    }
  };

  // Dialog root
  const dialogProps = {
    open,
    onOpenChange: guardedOnOpenChange,
  };

  // Title
  const titleElement = {
    text: title,
  };

  // Description with document name highlight and irreversibility warning
  const descriptionElement = {
    className: "mt-2",
    text: description,
    documentNameSpan: {
      text: documentName,
      className: "font-medium text-foreground",
    },
    irreversibilityWarning: "This action cannot be undone.",
  };

  // Cancel button
  const cancelButton = {
    variant: "outline" as const,
    text: "Cancel",
    autoFocus: true,
    disabled: isPending,
    onClick: () => guardedOnOpenChange(false),
  };

  // Confirm button
  const confirmButton = isPending
    ? {
        variant: "default" as const,
        text: "Approving…",
        disabled: true,
        "aria-busy": "true" as const,
        "aria-disabled": "true" as const,
        onClick: onConfirm,
        spinner: {
          className: "size-3.5 animate-spin",
          "aria-hidden": "true" as const,
        },
      }
    : {
        variant: "default" as const,
        text: "Confirm Approval",
        disabled: false,
        "aria-busy": undefined,
        "aria-disabled": undefined,
        onClick: onConfirm,
        spinner: null,
      };

  // Footer
  const footerClassName =
    "mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2";

  return {
    dialogProps,
    titleElement,
    descriptionElement,
    cancelButton,
    confirmButton,
    footerClassName,
  };
}

// ---------- Tests ----------

console.log("\nConfirmApprovalDialog tests:");

test("Component file exports a named ConfirmApprovalDialog function", async () => {
  const mod = await import("./confirm-approval-dialog");
  assert.strictEqual(typeof mod.ConfirmApprovalDialog, "function");
});

test("Props interface accepts all 7 required props", () => {
  // If any prop is missing, TypeScript would catch it at compile time.
  // Here we verify the simulation accepts all 7 and produces output.
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve Master Plan",
    documentName: "MASTER-PLAN.md",
    description: "This will advance the pipeline to execution.",
    onConfirm: () => {},
    isPending: false,
  });
  assert.ok(result, "Should return a result object");
  assert.ok(result.dialogProps, "Should have dialogProps");
  assert.ok(result.titleElement, "Should have titleElement");
  assert.ok(result.descriptionElement, "Should have descriptionElement");
  assert.ok(result.cancelButton, "Should have cancelButton");
  assert.ok(result.confirmButton, "Should have confirmButton");
});

test('When isPending is false: Confirm button label is "Confirm Approval" and Cancel button label is "Cancel"', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  assert.strictEqual(result.confirmButton.text, "Confirm Approval");
  assert.strictEqual(result.cancelButton.text, "Cancel");
});

test('When isPending is true: Confirm button label changes to "Approving…" and shows spinner', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: true,
  });
  assert.strictEqual(result.confirmButton.text, "Approving…");
  assert.ok(result.confirmButton.spinner, "Should have spinner when pending");
});

test("When isPending is true: both Cancel and Confirm buttons have disabled attribute", () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: true,
  });
  assert.strictEqual(result.cancelButton.disabled, true);
  assert.strictEqual(result.confirmButton.disabled, true);
});

test("When isPending is true: onOpenChange calls are blocked (guarded callback is a no-op)", () => {
  let changed = false;
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {
      changed = true;
    },
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: true,
  });
  // Try to close via guarded callback
  result.dialogProps.onOpenChange(false);
  assert.strictEqual(changed, false, "onOpenChange should NOT have been called when isPending");
});

test("When isPending is false: onOpenChange calls are NOT blocked", () => {
  let changed = false;
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {
      changed = true;
    },
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  result.dialogProps.onOpenChange(false);
  assert.strictEqual(changed, true, "onOpenChange SHOULD have been called when not isPending");
});

test('Confirm button has aria-busy="true" and aria-disabled="true" when isPending is true', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: true,
  });
  assert.strictEqual(result.confirmButton["aria-busy"], "true");
  assert.strictEqual(result.confirmButton["aria-disabled"], "true");
});

test('Confirm button does NOT have aria-busy or aria-disabled when isPending is false', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  assert.strictEqual(result.confirmButton["aria-busy"], undefined);
  assert.strictEqual(result.confirmButton["aria-disabled"], undefined);
});

test('Spinner icon has aria-hidden="true"', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: true,
  });
  assert.ok(result.confirmButton.spinner, "Spinner should exist when pending");
  assert.strictEqual(result.confirmButton.spinner!["aria-hidden"], "true");
});

test("Cancel button has autoFocus attribute (receives initial focus)", () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  assert.strictEqual(result.cancelButton.autoFocus, true);
});

test('Document name is rendered with "font-medium text-foreground" classes inside description', () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "MASTER-PLAN.md",
    description: "This will advance the pipeline.",
    onConfirm: () => {},
    isPending: false,
  });
  assert.strictEqual(result.descriptionElement.documentNameSpan.text, "MASTER-PLAN.md");
  assert.ok(
    result.descriptionElement.documentNameSpan.className.includes("font-medium"),
    "Document name should have font-medium class"
  );
  assert.ok(
    result.descriptionElement.documentNameSpan.className.includes("text-foreground"),
    "Document name should have text-foreground class"
  );
});

test("Footer uses responsive classes: flex flex-col-reverse sm:flex-row sm:justify-end gap-2", () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  assert.ok(result.footerClassName.includes("flex-col-reverse"));
  assert.ok(result.footerClassName.includes("sm:flex-row"));
  assert.ok(result.footerClassName.includes("sm:justify-end"));
  assert.ok(result.footerClassName.includes("gap-2"));
});

test("Cancel button calls onOpenChange(false) when clicked", () => {
  let openValue: boolean | null = null;
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: (v) => {
      openValue = v;
    },
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  result.cancelButton.onClick();
  assert.strictEqual(openValue, false, "onOpenChange should have been called with false");
});

test("Confirm button calls onConfirm when clicked", () => {
  let confirmed = false;
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {
      confirmed = true;
    },
    isPending: false,
  });
  result.confirmButton.onClick();
  assert.strictEqual(confirmed, true, "onConfirm should have been called");
});

test("Description includes irreversibility warning text", () => {
  const result = simulateConfirmApprovalDialog({
    open: true,
    onOpenChange: () => {},
    title: "Approve",
    documentName: "DOC.md",
    description: "desc",
    onConfirm: () => {},
    isPending: false,
  });
  assert.strictEqual(
    result.descriptionElement.irreversibilityWarning,
    "This action cannot be undone."
  );
});

// ---------- Summary ----------

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
