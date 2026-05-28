export type SlotRole = "custom-action-pre" | "shipped-action" | "custom-event-pre" | "shipped-event" | "custom-event-post";
export interface PairSlot { role: SlotRole }
export interface PairSubject { kind: "action" | "event"; name: string; completion_event?: string | null; is_orphan?: boolean }

export function applicableSlotsFor(subject: PairSubject): PairSlot[] {
  if (subject.kind === "event") {
    // Orphan events have no specific signalling agent for `pre` content to
    // address (anyone — a human via CLI, an ad-hoc script, an agent's judgment
    // call — could fire the signal), so the pre slot stays hidden. The post
    // slot has a clear semantic: "what to do after this signal fires." The
    // engine wires it as a preamble on the next action's composed prompt when
    // the firing signal is orphan.
    if (subject.is_orphan === true) {
      return [{ role: "shipped-event" }, { role: "custom-event-post" }];
    }
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
    case "custom-action-pre": return "1. Before doing this action";
    case "shipped-action":    return "2. Action";
    case "custom-event-pre":  return "3. Before signaling";
    case "shipped-event":     return "4. When complete";
    case "custom-event-post": return "5. After signaling";
  }
}
