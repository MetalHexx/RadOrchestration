"use client";

import { useState, useEffect, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useDocumentDrawer } from "@/hooks/use-document-drawer";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/sidebar";
import { MainDashboard } from "@/components/layout";
import { DocumentDrawer } from "@/components/documents";
import { DAGTimeline, ProjectHeader } from "@/components/dag-timeline";
import { getOrderedDocs, getOrderedDocsV5 } from "@/lib/document-ordering";
import { isV5State } from "@/types/state";
import type { ProjectState, ProjectStateV5 } from "@/types/state";
import type { ProjectSummary } from "@/types/components";

export default function ProjectsPage() {
  const {
    projects,
    selectedProject,
    projectState,
    selectProject,
    isLoading,
    error,
  } = useProjects();

  const {
    isOpen,
    docPath,
    loading: docLoading,
    error: docError,
    data: docData,
    openDocument,
    close: closeDocument,
    navigateTo,
    scrollAreaRef,
  } = useDocumentDrawer({ projectName: selectedProject });

  const [fileList, setFileList] = useState<string[]>([]);

  const selected: ProjectSummary | undefined = useMemo(
    () => projects.find((p) => p.name === selectedProject),
    [projects, selectedProject],
  );

  const isV5 = useMemo(
    () => (projectState ? isV5State(projectState) : false),
    [projectState],
  );

  const v4State: ProjectState | null = useMemo(
    () => (projectState && !isV5State(projectState) ? projectState : null),
    [projectState],
  );

  const orderedDocs = useMemo(() => {
    if (isV5 && projectState && selectedProject) {
      return getOrderedDocsV5(projectState as ProjectStateV5, selectedProject, fileList);
    }
    if (v4State && selectedProject) {
      return getOrderedDocs(v4State, selectedProject, fileList);
    }
    return [];
  }, [isV5, projectState, v4State, selectedProject, fileList]);

  useEffect(() => {
    if (!selectedProject) {
      setFileList([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(selectedProject)}/files`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch files");
        return res.json();
      })
      .then((data: { files: string[] }) => {
        if (!cancelled) setFileList(data.files);
      })
      .catch(() => {
        if (!cancelled) setFileList([]);
      });
    return () => { cancelled = true; };
  }, [selectedProject]);

  return (
    <div className="flex h-page flex-col bg-background">
      <SidebarProvider>
        <ProjectSidebar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={selectProject}
          isLoading={isLoading}
        />

        <SidebarInset id="main-content">
          {isLoading && !selected ? (
            <div className="flex h-full items-center justify-center" role="status" aria-label="Loading projects">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">
                  Loading projects…
                </p>
              </div>
            </div>
          ) : error && !selected ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center">
                <p className="text-sm text-destructive" role="alert">{error}</p>
              </div>
            </div>
          ) : selected && projectState && isV5State(projectState) ? (
            <div className="overflow-auto">
              <ProjectHeader
                projectName={selected.name}
                schemaVersion="v5"
              />
              <div className="px-6 py-4">
                <DAGTimeline
                  nodes={projectState.graph.nodes}
                  currentNodePath={projectState.graph.current_node_path}
                  onDocClick={openDocument}
                />
              </div>
            </div>
          ) : selected && v4State ? (
            <MainDashboard
              projectState={v4State}
              project={selected}
              onDocClick={openDocument}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">
                Select a project to begin
              </p>
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>

      <DocumentDrawer
        open={isOpen}
        docPath={docPath}
        loading={docLoading}
        error={docError}
        data={docData}
        onClose={closeDocument}
        scrollAreaRef={scrollAreaRef}
        docs={orderedDocs}
        onNavigate={navigateTo}
      />
    </div>
  );
}

