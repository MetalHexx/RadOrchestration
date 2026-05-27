"use client";

export function PairView({ kind, name }: { kind: "action" | "event"; name: string }) {
  return <div className="p-6 text-sm text-muted-foreground">Pair view for {kind}/{name} — implementation lands in P04.</div>;
}
