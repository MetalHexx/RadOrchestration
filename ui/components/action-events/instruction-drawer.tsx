"use client";
import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetScrollBody,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/documents/markdown-renderer";

export type DrawerMode =
  | { type: "preview"; kind: "action" | "event"; name: string; completion_event?: string | null;
      overlay: Record<string, string>; is_orphan?: boolean }
  | { type: "help" }
  | null;

interface Props { mode: DrawerMode; onClose: () => void; }

function subtitleFor(mode: DrawerMode): string {
  if (!mode) return "";
  if (mode.type === "help") return "Live custom/README.md from your installed catalog.";
  if (mode.kind === "event" && mode.is_orphan === true) {
    return "Runtime shape: this orphan event's post-overlay is prepended above the next action's composed prompt.";
  }
  return "Byte-for-byte preview of the envelope the orchestrator would compose.";
}

export function InstructionDrawer({ mode, onClose }: Props) {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const open = mode !== null;

  useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    async function load() {
      setContent(""); setError(null);
      try {
        if (mode!.type === "help") {
          const res = await fetch("/api/action-events/help/readme");
          if (!res.ok) throw new Error((await res.json()).error ?? "Help unavailable");
          const body = await res.json();
          if (!cancelled) setContent(body.content);
        } else {
          const isOrphan = mode!.kind === "event" && mode!.is_orphan === true;
          const payload = {
            kind: mode!.kind,
            name: mode!.name,
            completion_event: mode!.completion_event ?? null,
            overlay: mode!.overlay,
            ...(isOrphan ? { mode: "runtime-orphan" as const } : {}),
          };
          const res = await fetch("/api/action-events/compose", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Compose failed");
          const body = await res.json();
          if (!cancelled) setContent(body.prompt);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [mode]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="!w-full md:!w-[80vw] md:!max-w-[80vw]"
        aria-label={mode?.type === "help" ? "Help" : "Composed prompt preview"}
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{mode?.type === "help" ? "Help" : "Composed prompt preview"}</SheetTitle>
          <SheetDescription>{subtitleFor(mode)}</SheetDescription>
        </SheetHeader>
        <SheetScrollBody>
          <ScrollArea className="h-full">
            {error
              ? <div className="p-4 text-sm text-destructive">{error}</div>
              : <div className="px-6 py-4"><MarkdownRenderer content={content || "(empty)"} /></div>}
          </ScrollArea>
        </SheetScrollBody>
      </SheetContent>
    </Sheet>
  );
}
