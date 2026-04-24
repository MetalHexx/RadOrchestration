"use client";

import { useState, useEffect, useMemo } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useDocumentDrawer } from "@/hooks/use-document-drawer";
import { useFollowMode } from "@/hooks/use-follow-mode";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { useConfigClickContext } from "@/hooks/use-config-click-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/sidebar";
import { MainDashboard, NotStartedPaneV5 } from "@/components/layout";
import { useStartAction } from "@/hooks/use-start-action";
import { DocumentDrawer } from "@/components/documents";
import { ConfigEditorPanel } from "@/components/config";
import { DAGTimeline, DAGTimelineSkeleton, ProjectHeader, HaltReasonBanner, deriveCurrentPhase, derivePhaseProgress, deriveRepoBaseUrl } from "@/components/dag-timeline";
import { SSEStatusBanner } from "@/components/badges";
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
    sseStatus,
    reconnect,
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

  const v5State: ProjectStateV5 | null =
    projectState && isV5State(projectState) ? projectState : null;

  const nodesForFollowMode = v5State ? v5State.graph.nodes : null;
  const { followMode, expandedLoopIds, onAccordionChange, toggleFollowMode } = useFollowMode(nodesForFollowMode, selectedProject);

  const configEditor = useConfigEditor();
  const { setOnConfigClick } = useConfigClickContext();

  useEffect(() => {
    setOnConfigClick(configEditor.open);
    return () => { setOnConfigClick(undefined); };
  }, [setOnConfigClick, configEditor.open]);

  const selected: ProjectSummary | undefined = useMemo(
    () => projects.find((p) => p.name === selectedProject),
    [projects, selectedProject],
  );

  const v4State: ProjectState | null = useMemo(
    () => (projectState && !isV5State(projectState) ? projectState : null),
    [projectState],
  );

  const startAction = useStartAction(selectedProject);

  const v5Derivations = useMemo(() => {
    if (!v5State) {
      return { graphStatus: undefined, gateMode: undefined, currentPhaseName: null, progress: null, repoBaseUrl: null };
    }
    const phaseLoopNode = v5State.graph.nodes.phase_loop;
    const typedPhaseLoop = phaseLoopNode?.kind === 'for_each_phase' ? phaseLoopNode : undefined;
    return {
      graphStatus: v5State.graph.status,
      gateMode: v5State.pipeline.gate_mode,
      currentPhaseName: deriveCurrentPhase(typedPhaseLoop),
      progress: derivePhaseProgress(typedPhaseLoop),
      repoBaseUrl: deriveRepoBaseUrl(v5State.pipeline.source_control?.compare_url ?? null),
    };
  }, [v5State]);

  const orderedDocs = useMemo(() => {
    if (v5State && selectedProject) {
      return getOrderedDocsV5(v5State, selectedProject, fileList);
    }
    if (v4State && selectedProject) {
      return getOrderedDocs(v4State, selectedProject, fileList);
    }
    return [];
  }, [v5State, v4State, selectedProject, fileList]);

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
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      <SidebarProvider className="min-h-0 flex-1">
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
          ) : selected && selected.schemaVersion === 'v5' && !v5State && !v4State ? (
            <div className="overflow-auto">
              <ProjectHeader
                projectName={selected.name}
                schemaVersion="v5"
                sourceControl={null}
                followMode={false}
                onToggleFollowMode={() => {}}
              />
              <div className="flex flex-col">
                <HaltReasonBanner
                  graphStatus={v5Derivations.graphStatus}
                  haltReason={null}
                />
                <SSEStatusBanner
                  status={sseStatus}
                  onReconnect={reconnect}
                />
              </div>
              <div className="px-6 py-4">
                <DAGTimelineSkeleton />
              </div>
            </div>
          ) : selected && v5State ? (
            <div className="overflow-auto">
              <ProjectHeader
                projectName={selected.name}
                schemaVersion="v5"
                graphStatus={v5Derivations.graphStatus}
                gateMode={v5Derivations.gateMode}
                currentPhaseName={v5Derivations.currentPhaseName}
                progress={v5Derivations.progress}
                sourceControl={v5State.pipeline.source_control}
                followMode={followMode}
                onToggleFollowMode={toggleFollowMode}
              />
              <div className="flex flex-col">
                <HaltReasonBanner
                  graphStatus={v5Derivations.graphStatus}
                  haltReason={v5State.pipeline.halt_reason}
                />
                <SSEStatusBanner
                  status={sseStatus}
                  onReconnect={reconnect}
                />
              </div>
              <div className="px-6 py-4">
                <DAGTimeline
                  nodes={v5State.graph.nodes}
                  currentNodePath={v5State.graph.current_node_path}
                  onDocClick={openDocument}
                  expandedLoopIds={expandedLoopIds}
                  onAccordionChange={onAccordionChange}
                  repoBaseUrl={v5Derivations.repoBaseUrl}
                  projectName={selected.name}
                />
              </div>
            </div>
          ) : selected && v4State ? (
            <MainDashboard
              projectState={v4State}
              project={selected}
              onDocClick={openDocument}
            />
          ) : selected && selected.tier === 'not_initialized' && !v5State && !v4State && !selected.hasMalformedState ? (
            <NotStartedPaneV5
              projectName={selected.name}
              brainstormingDoc={selected.brainstormingDoc ?? null}
              onViewBrainstorming={openDocument}
              onStartPlanning={() => startAction.start('start-planning')}
              onStartBrainstorming={() => startAction.start('start-brainstorming')}
              pendingAction={startAction.pendingAction}
              errorMessage={startAction.errorMessage}
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

      <ConfigEditorPanel editor={configEditor} />
    </div>
  );
}

