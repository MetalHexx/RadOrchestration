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

function getProjectSortKey(p: ProjectSummary): number {
  const { tier, planningStatus, executionStatus, hasMalformedState } = p;

  // Priority 0: halted — tier-level OR execution sub-status (must be first)
  if (tier === "halted" || (tier === "execution" && executionStatus === "halted")) return 0;

  // Priority 1: malformed / warning state
  if (hasMalformedState) return 1;

  // Priority 2: final review gate
  if (tier === "review") return 2;

  // Priority 3: actively executing
  if (tier === "execution" && executionStatus === "in_progress") return 3;

  // Priority 4: actively planning
  if (tier === "planning" && planningStatus === "in_progress") return 4;

  // Priority 5: cleared planning gate, queued for execution
  if (tier === "execution" && (executionStatus === "not_started" || executionStatus === undefined)) return 5;

  // Priority 6: planning complete, awaiting execution gate approval
  if (tier === "planning" && planningStatus === "complete") return 6;

  // Priority 7: planning not yet started
  if (tier === "planning" && (planningStatus === "not_started" || planningStatus === undefined)) return 7;

  // Priority 8: not yet initialized
  if (tier === "not_initialized") return 8;

  // Priority 9: complete (or any unrecognized/edge-case combination)
  return 9;
}

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

  const filteredProjects = projects
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => getProjectSortKey(a) - getProjectSortKey(b) || a.name.localeCompare(b.name));

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
