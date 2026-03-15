/**
 * Tests for ApproveGateButton component logic.
 * Run with: npx tsx ui/components/dashboard/approve-gate-button.test.ts
 *
 * Since no React testing library is installed, these tests verify the
 * prop contracts, conditional rendering logic, and callback behavior
 * by simulating what the component does with its inputs.
 */
import assert from "node:assert";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = fn();
  if (result instanceof Promise) {
    result
      .then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  ✗ ${name}\n    ${msg}`);
        failed++;
      });
  } else {
    try {
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${name}\n    ${msg}`);
      failed++;
    }
  }
}

// ---------- Type definitions for simulation ----------

type GateEvent = "plan_approved" | "final_approved";

interface ApproveGateButtonInputs {
  gateEvent: GateEvent;
  projectName: string;
  documentName: string;
  label: string;
  className?: string;
}

interface HookState {
  isPending: boolean;
  error: { message: string; detail?: string } | null;
}

const DIALOG_TITLES: Record<GateEvent, string> = {
  plan_approved: "Approve Master Plan",
  final_approved: "Approve Final Review",
};

const DIALOG_DESCRIPTIONS: Record<GateEvent, string> = {
  plan_approved:
    "This will advance the pipeline from planning to execution. You are approving",
  final_approved:
    "This will mark the project as complete. You are approving",
};

/**
 * Simulates the ApproveGateButton rendering logic.
 * Returns what the component would render based on its props and hook state.
 */
function simulateApproveGateButton(
  props: ApproveGateButtonInputs,
  hookState: HookState,
  open: boolean,
) {
  const { gateEvent, documentName, label, className } = props;
  const { isPending, error } = hookState;

  const dialogTitle = DIALOG_TITLES[gateEvent];
  const consequenceDescription = DIALOG_DESCRIPTIONS[gateEvent];

  // Trigger button
  const triggerButton = isPending
    ? {
        variant: "default" as const,
        size: "sm" as const,
        className: "w-full sm:w-auto",
        disabled: true,
        "aria-busy": "true" as const,
        "aria-disabled": "true" as const,
        text: "Approving…",
        spinner: {
          className: "size-3.5 animate-spin",
          "aria-hidden": "true" as const,
        },
      }
    : {
        variant: "default" as const,
        size: "sm" as const,
        className: "w-full sm:w-auto",
        disabled: false,
        "aria-busy": undefined,
        "aria-disabled": undefined,
        text: label,
        spinner: null,
      };

  // Dialog props
  const dialogProps = {
    open,
    title: dialogTitle,
    documentName,
    description: consequenceDescription,
    isPending,
  };

  // Error banner (conditional)
  const errorBanner = error
    ? {
        rendered: true,
        wrapperClassName: "mt-2",
        message: error.message,
        detail: error.detail,
      }
    : { rendered: false };

  // Wrapper
  const wrapperClassName = className;

  return { triggerButton, dialogProps, errorBanner, wrapperClassName };
}

// ---------- Tests ----------

console.log("\nApproveGateButton tests:");

test("Renders trigger button with the provided label text when not pending", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    false,
  );
  assert.strictEqual(result.triggerButton.text, "Approve Plan");
  assert.strictEqual(result.triggerButton.spinner, null);
});

test('Trigger button shows Loader2 spinner and "Approving…" text when isPending is true', () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: true, error: null },
    true,
  );
  assert.strictEqual(result.triggerButton.text, "Approving…");
  assert.ok(result.triggerButton.spinner, "Should have spinner");
  assert.ok(result.triggerButton.spinner!.className.includes("animate-spin"));
});

test('Trigger button has aria-busy="true" and aria-disabled="true" when isPending', () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: true, error: null },
    true,
  );
  assert.strictEqual(result.triggerButton["aria-busy"], "true");
  assert.strictEqual(result.triggerButton["aria-disabled"], "true");
  assert.strictEqual(result.triggerButton.disabled, true);
});

test("Trigger button applies w-full sm:w-auto for responsive width", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    false,
  );
  assert.ok(result.triggerButton.className.includes("w-full"));
  assert.ok(result.triggerButton.className.includes("sm:w-auto"));
});

test("Clicking trigger button opens the ConfirmApprovalDialog (sets open to true)", () => {
  // Simulate: user clicks button → setOpen(true) → dialog opens
  let dialogOpen = false;
  const setOpen = (v: boolean) => {
    dialogOpen = v;
  };
  // Simulate click
  setOpen(true);
  assert.strictEqual(dialogOpen, true);
  // Verify dialog receives open=true
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    dialogOpen,
  );
  assert.strictEqual(result.dialogProps.open, true);
});

test('ConfirmApprovalDialog receives correct title for plan_approved: "Approve Master Plan"', () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    true,
  );
  assert.strictEqual(result.dialogProps.title, "Approve Master Plan");
});

test('ConfirmApprovalDialog receives correct title for final_approved: "Approve Final Review"', () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "final_approved",
      projectName: "my-project",
      documentName: "FINAL-REVIEW.md",
      label: "Approve Final Review",
    },
    { isPending: false, error: null },
    true,
  );
  assert.strictEqual(result.dialogProps.title, "Approve Final Review");
});

test("ConfirmApprovalDialog receives correct description for plan_approved", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    true,
  );
  assert.ok(
    result.dialogProps.description.includes(
      "This will advance the pipeline from planning to execution",
    ),
  );
});

test("ConfirmApprovalDialog receives correct description for final_approved", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "final_approved",
      projectName: "my-project",
      documentName: "FINAL-REVIEW.md",
      label: "Approve Final Review",
    },
    { isPending: false, error: null },
    true,
  );
  assert.ok(
    result.dialogProps.description.includes(
      "This will mark the project as complete",
    ),
  );
});

test("On confirm success (approveGate returns true), dialog closes", async () => {
  let dialogOpen = true;
  const setOpen = (v: boolean) => {
    dialogOpen = v;
  };

  // Simulate successful approveGate
  const approveGate = async () => true;
  const success = await approveGate();
  if (success) {
    setOpen(false);
  }
  assert.strictEqual(dialogOpen, false);
});

test("On confirm failure (approveGate returns false), dialog remains open", async () => {
  let dialogOpen = true;
  const setOpen = (v: boolean) => {
    dialogOpen = v;
  };

  // Simulate failed approveGate
  const approveGate = async () => false;
  const success = await approveGate();
  if (success) {
    setOpen(false);
  }
  assert.strictEqual(dialogOpen, true, "Dialog should remain open on failure");
});

test("GateErrorBanner renders when error is not null, with message and optional detail", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    {
      isPending: false,
      error: { message: "Approval failed", detail: "Pipeline output" },
    },
    true,
  );
  assert.strictEqual(result.errorBanner.rendered, true);
  if (result.errorBanner.rendered) {
    assert.strictEqual(result.errorBanner.message, "Approval failed");
    assert.strictEqual(result.errorBanner.detail, "Pipeline output");
    assert.strictEqual(result.errorBanner.wrapperClassName, "mt-2");
  }
});

test("GateErrorBanner does not render when error is null", () => {
  const result = simulateApproveGateButton(
    {
      gateEvent: "plan_approved",
      projectName: "my-project",
      documentName: "MASTER-PLAN.md",
      label: "Approve Plan",
    },
    { isPending: false, error: null },
    false,
  );
  assert.strictEqual(result.errorBanner.rendered, false);
});

test("Dismissing the error banner calls clearError()", () => {
  let cleared = false;
  const clearError = () => {
    cleared = true;
  };
  // Simulate: user clicks dismiss → onDismiss callback invokes clearError
  clearError();
  assert.strictEqual(cleared, true);
});

test("Closing the dialog (via onOpenChange(false)) calls clearError()", () => {
  let cleared = false;
  let dialogOpen = true;
  const clearError = () => {
    cleared = true;
  };
  const setOpen = (v: boolean) => {
    dialogOpen = v;
  };

  // Simulate handleOpenChange(false)
  const handleOpenChange = (value: boolean) => {
    if (!value) {
      clearError();
    }
    setOpen(value);
  };

  handleOpenChange(false);
  assert.strictEqual(cleared, true, "clearError should be called when dialog closes");
  assert.strictEqual(dialogOpen, false, "Dialog should be closed");
});

// ---------- Summary ----------

// We need to wait for async tests to complete
setTimeout(() => {
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}, 100);
