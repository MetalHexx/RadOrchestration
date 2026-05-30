"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProjects } from "@/hooks/use-projects";
import { useDocumentDrawer } from "@/hooks/use-document-drawer";
import { useFollowMode } from "@/hooks/use-follow-mode";
import { useConfigEditor } from "@/hooks/use-config-editor";
import { useConfigClickContext } from "@/hooks/use-config-click-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ProjectSidebar } from "@/components/sidebar";
import { MainDashboard, LaunchScreen } from "@/components/layout";
import { useStartAction } from "@/hooks/use-start-action";
import { useProjectArtifacts, deleteArtifact } from "@/hooks/use-project-artifacts";
import { DocumentDrawer } from "@/components/documents";
import { ConfirmApprovalDialog } from "@/components/dashboard";
import { ConfigEditorPanel } from "@/components/config";
import { DAGTimeline, DAGTimelineSkeleton, ProjectHeader, HaltReasonBanner, BrainstormingSection, deriveCurrentPhase, derivePhaseProgress, deriveRepoBaseUrl } from "@/components/dag-timeline";
import { SSEStatusBanner } from "@/components/badges";
import { getOrderedDocs, getOrderedDocsV5 } from "@/lib/document-ordering";
import { isV5State } from "@/types/state";
import type { ProjectState, ProjectStateV5 } from "@/types/state";
import type { ProjectSummary } from "@/types/components";
import { ArtifactViewerModal } from "@/components/artifacts";
import { useArtifactModal, markdownPathForActive } from "@/hooks/use-artifact-modal";

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
  const [fileMtimes, setFileMtimes] = useState<Record<string, number>>({});

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

  const [pendingDelete, setPendingDelete] = useState<import("@/lib/artifact-model").Artifact | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [fileRefetch, setFileRefetch] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [modalMarkdown, setModalMarkdown] = useState<string | null>(null);

  const artifacts = useProjectArtifacts(selectedProject, fileList, fileMtimes);

  const getArtifactCount = useCallback(() => artifacts.length, [artifacts.length]);
  const modal = useArtifactModal(-1, getArtifactCount);
  const openArtifactModal = modal.openAt;

  useEffect(() => { if (!modal.open) setIsFullScreen(false); }, [modal.open]);

  useEffect(() => {
    const mdPath = markdownPathForActive(artifacts, modal.index);
    if (!modal.open || !mdPath || !selectedProject) {
      setModalMarkdown(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(selectedProject)}/document?path=${encodeURIComponent(mdPath)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch markdown");
        return res.json();
      })
      .then((data: { content: string }) => {
        if (!cancelled) setModalMarkdown(data.content);
      })
      .catch(() => {
        if (!cancelled) setModalMarkdown('');
      });
    return () => { cancelled = true; };
  }, [modal.open, modal.index, artifacts, selectedProject]);

  const v5Derivations = useMemo(() => {
    if (!v5State) {
      return { graphStatus: undefined, gateMode: undefined, currentPhaseName: null, progress: null, repoBaseUrl: null, phaseLoopStatus: undefined };
    }
    const phaseLoopNode = v5State.graph.nodes.phase_loop;
    const typedPhaseLoop = phaseLoopNode?.kind === 'for_each_phase' ? phaseLoopNode : undefined;
    return {
      graphStatus: v5State.graph.status,
      gateMode: v5State.pipeline.gate_mode,
      currentPhaseName: deriveCurrentPhase(typedPhaseLoop),
      progress: derivePhaseProgress(typedPhaseLoop),
      repoBaseUrl: deriveRepoBaseUrl(v5State.pipeline.source_control?.compare_url ?? null),
      phaseLoopStatus: typedPhaseLoop?.status,
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
      setFileMtimes({});
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${encodeURIComponent(selectedProject)}/files`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch files");
        return res.json();
      })
      .then((data: { files: string[]; mtimes?: Record<string, number> }) => {
        if (!cancelled) {
          setFileList(data.files);
          setFileMtimes(data.mtimes ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFileList([]);
          setFileMtimes({});
        }
      });
    return () => { cancelled = true; };
  }, [selectedProject, fileRefetch]);

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
                tier={selected.tier}
                planningStatus={selected.planningStatus}
                executionStatus={selected.executionStatus}
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
                tier={selected.tier}
                planningStatus={selected.planningStatus}
                executionStatus={selected.executionStatus}
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
                <BrainstormingSection
                  artifacts={artifacts}
                  onOpen={(index) => openArtifactModal(index)}
                  onDelete={(a) => setPendingDelete(a)}
                />
                <DAGTimeline
                  nodes={v5State.graph.nodes}
                  currentNodePath={v5State.graph.current_node_path}
                  onDocClick={openDocument}
                  expandedLoopIds={expandedLoopIds}
                  onAccordionChange={onAccordionChange}
                  repoBaseUrl={v5Derivations.repoBaseUrl}
                  projectName={selected.name}
                  phaseLoopStatus={v5Derivations.phaseLoopStatus}
                  prUrl={v5State.pipeline.source_control?.pr_url ?? null}
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
            <LaunchScreen
              projectName={selected.name}
              artifacts={artifacts}
              onOpenArtifact={(index) => openArtifactModal(index)}
              onDeleteArtifact={(a) => setPendingDelete(a)}
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

      {modal.open && artifacts[modal.index] && (
        <ArtifactViewerModal
          projectName={selectedProject!}
          artifacts={artifacts}
          activeIndex={modal.index}
          markdownContent={modalMarkdown}
          onClose={modal.close}
          onPrev={modal.goPrev}
          onNext={modal.goNext}
          onSelect={(i) => modal.openAt(i)}
          onRequestDelete={() => setPendingDelete(artifacts[modal.index])}
          isFullScreen={isFullScreen}
          onToggleFullScreen={() => setIsFullScreen((v) => !v)}
        />
      )}

      <ConfirmApprovalDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title="Delete Artifact"
        documentName={pendingDelete?.fileName ?? ''}
        description="This will permanently remove"
        isPending={deletePending}
        onConfirm={async () => {
          if (!pendingDelete || !selectedProject) return;
          setDeletePending(true);
          await deleteArtifact(selectedProject, pendingDelete.fileName);
          setDeletePending(false);
          setPendingDelete(null);
          modal.onDeleted();
          setFileRefetch((n) => n + 1);
        }}
      />

      <ConfigEditorPanel editor={configEditor} />
    </div>
  );
}

