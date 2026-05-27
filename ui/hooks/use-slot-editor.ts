"use client";
import { useCallback, useEffect, useState } from "react";

export type Kind = "action" | "event";
export type Slot = "pre" | "post";

export interface SlotKey { kind: Kind; name: string; slot: Slot }
export interface SaveOp { method: "PUT" | "DELETE" | "NOOP"; body?: string }

export function computeDirtyFlag(current: string, saved: string): boolean {
  return current !== saved;
}
export function decideSaveOperation(input: { content: string; exists: boolean }): SaveOp {
  if (input.content === "") return input.exists ? { method: "DELETE" } : { method: "NOOP" };
  return { method: "PUT", body: input.content };
}

function urlFor(k: SlotKey): string {
  return `/api/action-events/custom/${k.kind}/${k.name}/${k.slot}`;
}

export function useSlotEditor(key: SlotKey, onDirtyChange: (key: string, dirty: boolean) => void, onPersistComplete?: () => void) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [exists, setExists] = useState(false);
  const dirty = computeDirtyFlag(content, savedContent);
  const overlayKey = `${key.kind}.${key.name}.${key.slot}`;

  useEffect(() => { onDirtyChange(overlayKey, dirty); }, [dirty, overlayKey, onDirtyChange]);

  const load = useCallback(async () => {
    const res = await fetch(urlFor(key));
    if (res.status === 404) { setContent(""); setSavedContent(""); setExists(false); return; }
    const body = await res.json();
    setContent(body.content); setSavedContent(body.content); setExists(true);
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    const op = decideSaveOperation({ content, exists });
    if (op.method === "NOOP") return;
    if (op.method === "DELETE") {
      const res = await fetch(urlFor(key), { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setExists(false); setSavedContent("");
    } else {
      const res = await fetch(urlFor(key), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: op.body }) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Save failed"); }
      setExists(true); setSavedContent(op.body!);
    }
    onPersistComplete?.();
  }, [content, exists, key, onPersistComplete]);

  const discard = useCallback(() => setContent(savedContent), [savedContent]);

  return { content, setContent, dirty, exists, save, discard, overlayKey };
}
