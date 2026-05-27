"use client";
import Link from "next/link";
import React, { useState } from "react";
import {
  Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useCatalog, groupCatalog, type ActionCategory } from "@/hooks/use-catalog";

const CATEGORY_ORDER: ActionCategory[] = ["agent-spawn", "gate", "terminal", "source-control"];

interface Props {
  selectedKind?: string;
  selectedName?: string;
  /** Called before in-app navigation. Return true to allow immediately, false to defer (guard). */
  onNavigateAttempt?: (href: string) => boolean;
}

export function CatalogSidebar({ selectedKind, selectedName, onNavigateAttempt }: Props) {
  const { entries, loading, error } = useCatalog();
  const [searchQuery, setSearchQuery] = useState("");
  const groups = groupCatalog(entries, searchQuery);

  const renderEntry = (e: typeof entries[number], hrefKind: "action" | "event") => {
    const isActive = selectedKind === hrefKind && selectedName === e.name;
    const href = `/action-events/${hrefKind}/${e.name}`;
    const handleClick = onNavigateAttempt
      ? (ev: React.MouseEvent) => { if (!onNavigateAttempt(href)) ev.preventDefault(); }
      : undefined;
    return (
      <SidebarMenuItem key={`${hrefKind}-${e.name}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={href} aria-current={isActive ? "page" : undefined}
              onClick={handleClick}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-sm ${isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}>
              <span className="font-mono">{e.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {e.populated_slot_count}/{e.applicable_slot_count}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>{`${e.populated_slot_count} of ${e.applicable_slot_count} custom instruction slots populated`}</TooltipContent>
              </Tooltip>
            </Link>
          </TooltipTrigger>
          <TooltipContent>{e.description}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarGroup>
          <SidebarGroupContent>
            <Input value={searchQuery} onChange={(ev) => setSearchQuery(ev.target.value)} placeholder="Filter by name…" />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarHeader>
      <SidebarContent>
        {error && (
          <div className="px-4 py-2 text-sm text-destructive">
            Failed to load catalog. {error.message}
          </div>
        )}
        {loading && entries.length === 0 && (
          <div className="px-4 py-2 text-sm text-muted-foreground">
            Loading catalog…
          </div>
        )}
        {CATEGORY_ORDER.map((cat) => {
          const list = groups.actions[cat];
          if (list.length === 0) return null;
          return (
            <SidebarGroup key={cat}>
              <SidebarGroupLabel>{cat}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>{list.map((e) => renderEntry(e, "action"))}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
        <SidebarGroup>
          <SidebarGroupLabel>orphan events</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{groups.orphans.map((e) => renderEntry(e, "event"))}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
