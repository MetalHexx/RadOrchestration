/**
 * Tests that Badge, Switch, SpinnerBadge, NodeStatusBadge, and GateModeBadge
 * are all React.forwardRef components.
 *
 * Regression: `TooltipTrigger` from @base-ui/react tries to wire a ref through
 * its child; if the child is a plain function component React logs a
 * "Function components cannot be given refs" warning (which Next's dev overlay
 * counts as an error). Wrapping each component in React.forwardRef resolves
 * the warning and connects the ref chain end-to-end.
 *
 * Run with: node --test --import tsx components/badges/forward-ref.test.ts
 */
import assert from "node:assert";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { SpinnerBadge } from "./spinner-badge";
import { GateModeBadge } from "./gate-mode-badge";
import { NodeStatusBadge } from "../dag-timeline/node-status-badge";

const FORWARD_REF_TYPE = Symbol.for("react.forward_ref");

function isForwardRef(component: unknown): boolean {
  return (
    typeof component === "object" &&
    component !== null &&
    "$$typeof" in component &&
    (component as { $$typeof: symbol }).$$typeof === FORWARD_REF_TYPE
  );
}

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

console.log("\nforwardRef regression tests\n");

test("Badge is a React.forwardRef component", () => {
  assert.strictEqual(isForwardRef(Badge), true);
});

test("Badge has a displayName for React devtools", () => {
  assert.strictEqual((Badge as unknown as { displayName?: string }).displayName, "Badge");
});

test("Switch is a React.forwardRef component", () => {
  assert.strictEqual(isForwardRef(Switch), true);
});

test("Switch has a displayName for React devtools", () => {
  assert.strictEqual((Switch as unknown as { displayName?: string }).displayName, "Switch");
});

test("SpinnerBadge is a React.forwardRef component", () => {
  assert.strictEqual(isForwardRef(SpinnerBadge), true);
});

test("SpinnerBadge has a displayName for React devtools", () => {
  assert.strictEqual((SpinnerBadge as unknown as { displayName?: string }).displayName, "SpinnerBadge");
});

test("NodeStatusBadge is a React.forwardRef component", () => {
  assert.strictEqual(isForwardRef(NodeStatusBadge), true);
});

test("NodeStatusBadge has a displayName for React devtools", () => {
  assert.strictEqual((NodeStatusBadge as unknown as { displayName?: string }).displayName, "NodeStatusBadge");
});

test("GateModeBadge is a React.forwardRef component", () => {
  assert.strictEqual(isForwardRef(GateModeBadge), true);
});

test("GateModeBadge has a displayName for React devtools", () => {
  assert.strictEqual((GateModeBadge as unknown as { displayName?: string }).displayName, "GateModeBadge");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
