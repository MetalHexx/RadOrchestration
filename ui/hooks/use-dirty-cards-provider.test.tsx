import { test, afterEach } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DirtyCardsProvider, useDirtyCards } from "./use-dirty-cards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setupDom(): { container: HTMLDivElement; root: Root } {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: "http://localhost:3000/",
  });
  Object.defineProperty(globalThis, "window", { value: dom.window, writable: true, configurable: true });
  Object.defineProperty(globalThis, "document", { value: dom.window.document, writable: true, configurable: true });
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, writable: true, configurable: true });
  const container = dom.window.document.getElementById("root") as HTMLDivElement;
  const root = createRoot(container);
  return { container, root };
}

afterEach(() => {
  // Reset DOM globals between tests.
});

test("DirtyCardsProvider shares state across sibling consumers — page guard sees card edits (FR-22)", () => {
  const { container, root } = setupDom();

  // Simulates the actual bug: one consumer (page-level guard) reads `anyDirty`,
  // a sibling consumer (card-level setter) calls `setDirty`. Without the provider
  // they were independent hook instances. With the provider they share.
  function PageGuardProbe() {
    const { anyDirty } = useDirtyCards();
    return <span data-testid="anydirty">{anyDirty ? "DIRTY" : "CLEAN"}</span>;
  }
  let capturedSetDirty: ((key: string, dirty: boolean) => void) | null = null;
  function CardProbe() {
    const { setDirty } = useDirtyCards();
    capturedSetDirty = setDirty;
    return null;
  }

  act(() => {
    root.render(
      <DirtyCardsProvider>
        <PageGuardProbe />
        <CardProbe />
      </DirtyCardsProvider>,
    );
  });

  assert.strictEqual(container.querySelector("[data-testid=anydirty]")?.textContent, "CLEAN");

  act(() => { capturedSetDirty!("action.exec.pre", true); });

  assert.strictEqual(
    container.querySelector("[data-testid=anydirty]")?.textContent,
    "DIRTY",
    "page-level anyDirty must update when sibling card calls setDirty — proves shared reducer (FR-22)",
  );

  act(() => { capturedSetDirty!("action.exec.pre", false); });
  assert.strictEqual(container.querySelector("[data-testid=anydirty]")?.textContent, "CLEAN");

  act(() => { root.unmount(); });
});

test("useDirtyCards throws when called without DirtyCardsProvider", () => {
  setupDom();
  // Mounting a component that calls useDirtyCards outside the provider must
  // throw so misconfiguration fails loudly instead of silently degrading
  // to the previous independent-state behavior.
  function Naked() {
    useDirtyCards();
    return null;
  }
  // Suppress the noisy React error boundary output by overriding console.error.
  const origError = console.error;
  console.error = () => {};
  try {
    const dom2 = new JSDOM(`<!doctype html><html><body><div id="r2"></div></body></html>`);
    const c2 = dom2.window.document.getElementById("r2") as HTMLDivElement;
    Object.defineProperty(globalThis, "document", { value: dom2.window.document, writable: true, configurable: true });
    const r2 = createRoot(c2);
    assert.throws(() => {
      act(() => { r2.render(<Naked />); });
    }, /useDirtyCards must be used inside <DirtyCardsProvider>/);
  } finally {
    console.error = origError;
  }
});
