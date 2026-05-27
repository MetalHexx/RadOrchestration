"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EditableSlotCard } from "./editable-slot-card";
import { ShippedCard } from "./shipped-card";
import { applicableSlotsFor, slotLabelFor, type SlotRole } from "./pair-view-meta";
import { useCatalog, findEntry } from "@/hooks/use-catalog";
import { useDirtyCards } from "@/hooks/use-dirty-cards";

interface ShippedPayload { body: string; title: string; description?: string; category?: string; completion_event?: string | null; signal_line?: string; }

interface Props {
  kind: "action" | "event";
  name: string;
  onOpenPreview?: (overlay: Record<string, string>) => void;
  onOpenHelp?: () => void;
}

export function PairView({ kind, name, onOpenPreview, onOpenHelp }: Props) {
  const { entries, refresh } = useCatalog();
  const entry = findEntry(entries, kind, name);
  const { setDirty } = useDirtyCards();
  const [shippedAction, setShippedAction] = useState<ShippedPayload | null>(null);
  const [shippedEvent, setShippedEvent] = useState<ShippedPayload | null>(null);
  const overlayRef = useRef<Record<string, string>>({});
  const card4Ref = useRef<HTMLDivElement | null>(null);

  const completion = entry?.kind === "action" ? entry.completion_event ?? null : null;
  const subject = entry ? { kind: entry.kind, name: entry.name, completion_event: completion } : null;
  const slots = subject ? applicableSlotsFor(subject) : [];

  useEffect(() => {
    async function load() {
      if (kind === "action") {
        const a = await fetch(`/api/action-events/shipped/action/${name}`); setShippedAction(a.ok ? await a.json() : null);
        if (completion) { const e = await fetch(`/api/action-events/shipped/event/${completion}`); setShippedEvent(e.ok ? await e.json() : null); }
      } else {
        const e = await fetch(`/api/action-events/shipped/event/${name}`); setShippedEvent(e.ok ? await e.json() : null);
      }
    }
    void load();
  }, [kind, name, completion]);

  const handlePersistComplete = useCallback(() => { void refresh(); }, [refresh]);
  const handleContentChange = useCallback((k: string, v: string) => { overlayRef.current[k] = v; }, []);

  const headerLeft = kind === "action"
    ? <h2 className="text-lg font-semibold font-mono">{name}{completion ? <> <span className="text-muted-foreground">→</span> {completion}</> : null}</h2>
    : <h2 className="text-lg font-semibold font-mono">{name}</h2>;

  const description = entry?.description ?? "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-row items-start justify-between">
        <div>
          {headerLeft}
          <p className="italic text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onOpenPreview?.({ ...overlayRef.current })}>Preview</Button>
          <Button variant="ghost" size="icon" aria-label="Help" onClick={() => onOpenHelp?.()}>?</Button>
        </div>
      </div>

      <div className="space-y-4">
        {slots.map((s) => renderSlot(s.role))}
      </div>
    </div>
  );

  function renderSlot(role: SlotRole) {
    const label = slotLabelFor(role);
    const parentName = kind === "action" ? name : null;
    switch (role) {
      case "custom-action-pre":
        return <EditableSlotCard key={role} slotLabel={label} slotKey={{ kind: "action", name: parentName!, slot: "pre" }}
          placeholder={`Custom instructions to prepend before this action runs. Save creates custom/action.${parentName}.pre.md.`}
          onDirtyChange={setDirty} onPersistComplete={handlePersistComplete} onContentChange={handleContentChange} />;
      case "shipped-action":
        return shippedAction ? <div key={role}><ShippedCard slotLabel={label} data={{ kind: "action", name, ...shippedAction }} onJumpToCompletionEvent={() => card4Ref.current?.scrollIntoView({ behavior: "smooth" })} /></div> : null;
      case "custom-event-pre": {
        const evName = kind === "event" ? name : completion!;
        return <EditableSlotCard key={role} slotLabel={label} slotKey={{ kind: "event", name: evName, slot: "pre" }}
          placeholder={`Custom instructions to prepend before signaling. Save creates custom/event.${evName}.pre.md.`}
          onDirtyChange={setDirty} onPersistComplete={handlePersistComplete} onContentChange={handleContentChange} />;
      }
      case "shipped-event":
        return shippedEvent ? <div key={role} ref={card4Ref}><ShippedCard slotLabel={label} data={{ kind: "event", name: kind === "event" ? name : completion!, ...shippedEvent }} /></div> : null;
      case "custom-event-post": {
        const evName = kind === "event" ? name : completion!;
        return <EditableSlotCard key={role} slotLabel={label} slotKey={{ kind: "event", name: evName, slot: "post" }}
          placeholder={`Custom instructions to append after signaling. Save creates custom/event.${evName}.post.md.`}
          onDirtyChange={setDirty} onPersistComplete={handlePersistComplete} onContentChange={handleContentChange} />;
      }
    }
  }
}
