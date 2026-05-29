"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { PairView } from "@/components/action-events/pair-view";
import { InstructionDrawer, type DrawerMode } from "@/components/action-events/instruction-drawer";
import { DirtyCardsProvider, useDirtyCards } from "@/hooks/use-dirty-cards";
import { UnsavedChangesDialog } from "@/components/action-events/unsaved-changes-dialog";
import { useCatalog, findEntry } from "@/hooks/use-catalog";

export default function ActionEventsPairPage() {
  // Wrap the page in <DirtyCardsProvider> so the navigation guard below and the
  // <EditableSlotCard>s reached through <PairView> share one reducer (FR-22).
  return (
    <DirtyCardsProvider>
      <PairPageContent />
    </DirtyCardsProvider>
  );
}

function PairPageContent() {
  const params = useParams<{ kind: string; name: string }>();
  const router = useRouter();
  const { anyDirty } = useDirtyCards();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const kind = params.kind as "action" | "event";
  const { entries } = useCatalog();

  return (
    <SidebarProvider>
      <CatalogSidebar
        selectedKind={params.kind}
        selectedName={params.name}
        onNavigateAttempt={(href) => {
          if (anyDirty) {
            setPendingHref(href);
            return false;
          }
          return true;
        }}
      />
      <SidebarInset>
        <PairView
          kind={kind} name={params.name}
          onOpenPreview={(overlay, completionEvent) => {
            const entry = findEntry(entries, kind, params.name);
            setDrawer({ type: "preview", kind, name: params.name, overlay, completion_event: completionEvent, is_orphan: entry?.is_orphan === true });
          }}
          onOpenHelp={() => setDrawer({ type: "help" })}
        />
        <InstructionDrawer mode={drawer} onClose={() => setDrawer(null)} />
      </SidebarInset>
      <UnsavedChangesDialog
        open={pendingHref !== null}
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          const next = pendingHref;
          setPendingHref(null);
          if (next) router.push(next);
        }}
      />
    </SidebarProvider>
  );
}
