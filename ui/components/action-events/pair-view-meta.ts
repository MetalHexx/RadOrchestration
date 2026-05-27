export type SlotRole = "custom-action-pre" | "shipped-action" | "custom-event-pre" | "shipped-event" | "custom-event-post";
export interface PairSlot { role: SlotRole }
export interface PairSubject { kind: "action" | "event"; name: string; completion_event?: string | null }

export function applicableSlotsFor(subject: PairSubject): PairSlot[] {
  if (subject.kind === "event") {
    return [{ role: "custom-event-pre" }, { role: "shipped-event" }, { role: "custom-event-post" }];
  }
  if (subject.completion_event === null || subject.completion_event === undefined) {
    return [{ role: "custom-action-pre" }, { role: "shipped-action" }];
  }
  return [
    { role: "custom-action-pre" }, { role: "shipped-action" },
    { role: "custom-event-pre" }, { role: "shipped-event" }, { role: "custom-event-post" },
  ];
}
export function slotLabelFor(role: SlotRole): string {
  switch (role) {
    case "custom-action-pre": return "1. Before doing this action — custom";
    case "shipped-action":    return "2. Action — shipped · read-only";
    case "custom-event-pre":  return "3. Before signaling — custom";
    case "shipped-event":     return "4. When complete — shipped · read-only";
    case "custom-event-post": return "5. After signaling — custom";
  }
}
