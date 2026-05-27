"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { PairView } from "@/components/action-events/pair-view";
import { InstructionDrawer, type DrawerMode } from "@/components/action-events/instruction-drawer";
import { useDirtyCards } from "@/hooks/use-dirty-cards";
import { UnsavedChangesDialog } from "@/components/action-events/unsaved-changes-dialog";

export default function ActionEventsPairPage() {
  const params = useParams<{ kind: string; name: string }>();
  const router = useRouter();
  const { anyDirty } = useDirtyCards();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const kind = params.kind as "action" | "event";

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
          onOpenPreview={(overlay) => setDrawer({ type: "preview", kind, name: params.name, overlay })}
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
