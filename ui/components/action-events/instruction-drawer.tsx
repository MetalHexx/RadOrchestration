"use client";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/documents/markdown-renderer";

export type DrawerMode = { type: "preview"; kind: "action" | "event"; name: string; completion_event?: string | null; overlay: Record<string, string> }
                        | { type: "help" } | null;

interface Props { mode: DrawerMode; onClose: () => void; }

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
          const res = await fetch("/api/action-events/compose", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: mode!.kind, name: mode!.name, completion_event: mode!.completion_event ?? null, overlay: mode!.overlay }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Compose failed");
          const body = await res.json();
          if (!cancelled) setContent(body.prompt);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Failed"); }
    }
    void load();
    return () => { cancelled = true; };
  }, [mode]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-[640px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{mode?.type === "help" ? "Help" : "Composed prompt preview"}</SheetTitle>
          <SheetDescription>
            {mode?.type === "help" ? "Live custom/README.md from your installed catalog." : "Byte-for-byte preview of the envelope the orchestrator would compose."}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {error ? <div className="p-4 text-sm text-destructive">{error}</div> : <div className="p-4"><MarkdownRenderer content={content || "(empty)"} /></div>}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
