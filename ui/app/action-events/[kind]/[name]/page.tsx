"use client";

import { useParams } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { PairView } from "@/components/action-events/pair-view";

export default function ActionEventsPairPage() {
  const params = useParams<{ kind: string; name: string }>();
  return (
    <SidebarProvider>
      <CatalogSidebar selectedKind={params.kind} selectedName={params.name} />
      <SidebarInset>
        <PairView kind={params.kind as "action" | "event"} name={params.name} />
      </SidebarInset>
    </SidebarProvider>
  );
}
