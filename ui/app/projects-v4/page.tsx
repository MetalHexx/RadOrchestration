"use client";

import { useState, useEffect, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useDocumentDrawer } from "@/hooks/use-document-drawer";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { useConfigClickContext } from "@/hooks/use-config-click-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/sidebar";
import { MainDashboard } from "@/components/layout";
import { DocumentDrawer } from "@/components/documents";
import { ConfigEditorPanel } from "@/components/config";
import { getOrderedDocs } from "@/lib/document-ordering";
import type { ProjectSummary } from "@/types/components";
import type { ConfigGetResponse } from "@/types/config";

export default function ProjectsV4Page() {
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

  const configEditor = useConfigEditor();

  const [fileList, setFileList] = useState<string[]>([]);
  const [globalMaxRetries, setGlobalMaxRetries] = useState<number>(3);

  const { setOnConfigClick } = useConfigClickContext();

  useEffect(() => {
    setOnConfigClick(configEditor.open);
    return () => { setOnConfigClick(undefined); };
  }, [setOnConfigClick, configEditor.open]);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ConfigGetResponse | null) => {
        if (data?.config?.limits?.max_retries_per_task != null) {
          setGlobalMaxRetries(data.config.limits.max_retries_per_task);
        }
      })
      .catch(() => {});
  }, []);

  const maxRetries = useMemo(
    () => projectState?.config?.limits?.max_retries_per_task ?? globalMaxRetries,
    [projectState, globalMaxRetries],
  );

  const orderedDocs = useMemo(
    () => projectState ? getOrderedDocs(projectState, selectedProject!, fileList) : [],
    [projectState, selectedProject, fileList],
  );

  const otherDocs = useMemo(
    () => orderedDocs.filter((d) => d.category === "other").map((d) => d.path),
    [orderedDocs],
  );

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

  const handleDocClick = (path: string) => {
    openDocument(path);
  };

  const selected: ProjectSummary | undefined = projects.find(
    (p) => p.name === selectedProject
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col bg-background">
      <SidebarProvider>
        <ProjectSidebar
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={selectProject}
          isLoading={isLoading}
        />

        <SidebarInset id="main-content">
          {isLoading && !selected ? (
            <div className="flex h-full items-center justify-center">
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
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          ) : selected ? (
            <MainDashboard
              projectState={projectState}
              project={selected}
              onDocClick={handleDocClick}
              otherDocs={otherDocs}
              maxRetries={maxRetries}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <div className="max-w-md text-center">
                <h2 className="mb-2 text-lg font-semibold text-foreground">
                  Orchestration Monitor
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select a project from the sidebar to view its dashboard.
                </p>
              </div>
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

      <ConfigEditorPanel editor={configEditor} />
    </div>
  );
}
