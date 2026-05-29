import { test, afterEach } from "node:test";
import assert from "node:assert";
import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CatalogProvider, useCatalog } from "./use-catalog";

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

function seedCatalogFetch(entries: unknown[]): () => void {
  const originalFetch = global.fetch;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = async (url: string) => {
    if (String(url).endsWith("/api/action-events/catalog")) {
      return new Response(JSON.stringify({ entries }), { status: 200 });
    }
    return new Response("{}", { status: 404 });
  };
  return () => { global.fetch = originalFetch; };
}

afterEach(() => { /* per-test fetch reset via returned restore() */ });

test("CatalogProvider shares state across sibling consumers — sidebar badge sees refreshEntry from pair-view (FR-21, AD-8)", async () => {
  const initialEntries = [
    { kind: "action", name: "exec", category: "agent-spawn", completion_event: null, applicable_slot_count: 3, populated_slot_count: 0, title: "t", description: "d", is_orphan: false },
  ];
  const restoreFetch = seedCatalogFetch(initialEntries);
  try {
    const { container, root } = setupDom();

    // Sidebar-shaped consumer: reads entries[].populated_slot_count for the row badge.
    function SidebarBadgeProbe() {
      const { entries } = useCatalog();
      const e = entries.find((x) => x.name === "exec");
      return <span data-testid="badge">{e ? e.populated_slot_count : -1}</span>;
    }
    // Pair-view-shaped consumer: gets refreshEntry that updates the shared store.
    let capturedRefresh: ((kind: string, name: string, n: number) => void) | null = null;
    function PairViewProbe() {
      const { refreshEntry } = useCatalog();
      capturedRefresh = refreshEntry;
      return null;
    }

    await act(async () => {
      root.render(
        <CatalogProvider>
          <SidebarBadgeProbe />
          <PairViewProbe />
        </CatalogProvider>,
      );
    });
    // Let the provider's initial fetch resolve before asserting.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    assert.strictEqual(
      container.querySelector("[data-testid=badge]")?.textContent,
      "0",
      "sidebar badge should reflect initial populated_slot_count from the shared store",
    );

    act(() => { capturedRefresh!("action", "exec", 1); });

    assert.strictEqual(
      container.querySelector("[data-testid=badge]")?.textContent,
      "1",
      "sidebar badge must update when sibling pair-view calls refreshEntry — proves shared store (FR-21, AD-8)",
    );

    act(() => { root.unmount(); });
  } finally {
    restoreFetch();
  }
});

test("useCatalog throws when called without CatalogProvider", () => {
  setupDom();
  function Naked() { useCatalog(); return null; }
  const origError = console.error;
  console.error = () => {};
  try {
    const dom2 = new JSDOM(`<!doctype html><html><body><div id="r2"></div></body></html>`);
    const c2 = dom2.window.document.getElementById("r2") as HTMLDivElement;
    Object.defineProperty(globalThis, "document", { value: dom2.window.document, writable: true, configurable: true });
    const r2 = createRoot(c2);
    assert.throws(() => {
      act(() => { r2.render(<Naked />); });
    }, /useCatalog must be used inside <CatalogProvider>/);
  } finally {
    console.error = origError;
  }
});
