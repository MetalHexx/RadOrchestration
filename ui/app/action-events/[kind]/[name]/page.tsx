"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { PairView } from "@/components/action-events/pair-view";
import { useDirtyCards } from "@/hooks/use-dirty-cards";
import { UnsavedChangesDialog } from "@/components/action-events/unsaved-changes-dialog";

export default function ActionEventsPairPage() {
  const params = useParams<{ kind: string; name: string }>();
  const router = useRouter();
  const { anyDirty } = useDirtyCards();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

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
        <PairView kind={params.kind as "action" | "event"} name={params.name} />
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
