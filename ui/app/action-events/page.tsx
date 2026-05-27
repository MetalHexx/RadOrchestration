"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { InstructionDrawer, type DrawerMode } from "@/components/action-events/instruction-drawer";
import { Button } from "@/components/ui/button";
import { useDirtyCards } from "@/hooks/use-dirty-cards";
import { UnsavedChangesDialog } from "@/components/action-events/unsaved-changes-dialog";

export default function ActionEventsPage() {
  const router = useRouter();
  const { anyDirty } = useDirtyCards();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerMode>(null);

  return (
    <SidebarProvider>
      <CatalogSidebar
        onNavigateAttempt={(href) => {
          if (anyDirty) {
            setPendingHref(href);
            return false;
          }
          return true;
        }}
      />
      <SidebarInset>
        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">Select an action or event from the sidebar to begin editing.</p>
          <Button variant="ghost" size="sm" onClick={() => setDrawer({ type: "help" })}>Open Help</Button>
        </div>
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
