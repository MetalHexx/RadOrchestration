"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";

export default function ActionEventsPage() {
  return (
    <SidebarProvider>
      <CatalogSidebar />
      <SidebarInset>
        <div className="p-6 text-sm text-muted-foreground">
          Select an action or event from the sidebar to begin editing.
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
