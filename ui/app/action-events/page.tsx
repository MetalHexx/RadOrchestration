"use client";

import { useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { CatalogSidebar } from "@/components/action-events/catalog-sidebar";
import { InstructionDrawer, type DrawerMode } from "@/components/action-events/instruction-drawer";
import { Button } from "@/components/ui/button";

export default function ActionEventsPage() {
  const [drawer, setDrawer] = useState<DrawerMode>(null);

  return (
    <SidebarProvider>
      <CatalogSidebar />
      <SidebarInset>
        <div className="p-6 space-y-3">
          <p className="text-sm text-muted-foreground">Select an action or event from the sidebar to begin editing.</p>
          <Button variant="ghost" size="sm" onClick={() => setDrawer({ type: "help" })}>Open Help</Button>
        </div>
        <InstructionDrawer mode={drawer} onClose={() => setDrawer(null)} />
      </SidebarInset>
    </SidebarProvider>
  );
}
