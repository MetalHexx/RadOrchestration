"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { useDirtyCards } from "@/hooks/use-dirty-cards";
import { UnsavedChangesDialog } from "@/components/action-events/unsaved-changes-dialog";

export default function ActionEventsPage() {
  const router = useRouter();
  const { anyDirty } = useDirtyCards();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

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
        <div className="p-6 text-sm text-muted-foreground">
          Select an action or event from the sidebar to begin editing.
        </div>
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
