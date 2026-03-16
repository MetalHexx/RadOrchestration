"use client";

import { useCallback, useState } from "react";
import type { ProjectSummary } from "@/types/components";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { SidebarSearch } from "./sidebar-search";
import { ProjectListItem } from "./project-list-item";

interface ProjectSidebarProps {
  projects: ProjectSummary[];
  selectedProject: string | null;
  onSelectProject: (name: string) => void;
  isLoading: boolean;
}

export function ProjectSidebar({
  projects,
  selectedProject,
  onSelectProject,
  isLoading,
}: ProjectSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const TIER_SORT_ORDER: Record<string, number> = {
    execution: 0,
    review: 1,
    planning: 2,
    not_initialized: 3,
    halted: 4,
    complete: 5,
  };

  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (TIER_SORT_ORDER[a.tier] ?? 3) - (TIER_SORT_ORDER[b.tier] ?? 3));

  const handleListboxKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLUListElement>) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const listbox = e.currentTarget;
      const items = Array.from(
        listbox.querySelectorAll<HTMLElement>('[role="option"]')
      );
      if (items.length === 0) return;
      const currentIndex = items.findIndex(
        (item) => item === document.activeElement
      );
      let nextIndex: number;
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      }
      items[nextIndex].focus();
    },
    []
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarGroupLabel className="text-base">Projects</SidebarGroupLabel>
      </SidebarHeader>

      <SidebarSearch value={searchQuery} onChange={setSearchQuery} />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu
              role="listbox"
              aria-label="Project list"
              onKeyDown={handleListboxKeyDown}
            >
              {isLoading && projects.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))
              ) : filteredProjects.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No matching projects
                </li>
              ) : (
                filteredProjects.map((project) => (
                  <SidebarMenuItem key={project.name}>
                    <ProjectListItem
                      project={project}
                      selected={selectedProject === project.name}
                      onClick={() => onSelectProject(project.name)}
                    />
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="px-4 py-2 text-xs text-muted-foreground">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
