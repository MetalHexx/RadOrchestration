"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectSummary } from "@/types/components";
import type { ProjectState } from "@/types/state";
import type { SSEEvent, SSEConnectionStatus } from "@/types/events";
import { useSSE } from "@/hooks/use-sse";

const STORAGE_KEY = "monitoring-ui-selected-project";

interface UseProjectsReturn {
  /** List of all discovered projects */
  projects: ProjectSummary[];
  /** Name of the currently selected project, or null */
  selectedProject: string | null;
  /** State for the selected project, or null if not available */
  projectState: ProjectState | null;
  /** Function to select a project by name */
  selectProject: (name: string) => void;
  /** True while any fetch is in progress */
  isLoading: boolean;
  /** Error message string, or null */
  error: string | null;
  /** SSE connection status from useSSE */
  sseStatus: SSEConnectionStatus;
  /** Manual reconnect function — tears down and re-creates EventSource */
  reconnect: () => void;
}

export function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectState, setProjectState] =
    useState<ProjectState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stable ref for selectedProject to use inside the SSE callback
  const selectedProjectRef = useCallback(() => selectedProject, [selectedProject]);

  const fetchProjectList = useCallback(async () => {
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects ?? []);
      }
    } catch {
      // Silently ignore — primary fetch handles errors
    }
  }, []);

  const handleSSEEvent = useCallback(
    (event: SSEEvent) => {
      const currentSelected = selectedProjectRef();

      switch (event.type) {
        case "state_change": {
          const payload = event.payload as { projectName: string; state: ProjectState };

          // Unconditionally patch the projects array (sidebar reactivity)
          setProjects(prev =>
            prev.map(p =>
              p.name === payload.projectName
                ? {
                    ...p,
                    tier: payload.state.pipeline.current_tier,
                    planningStatus: payload.state.planning?.status,
                    executionStatus: payload.state.execution?.status,
                  }
                : p
            )
          );

          // Existing behaviour: update detail view for the selected project
          if (payload.projectName === currentSelected) {
            setProjectState(payload.state);
          }
          break;
        }
        case "connected":
        case "project_added": {
          fetchProjectList();
          break;
        }
        case "project_removed": {
          const payload = event.payload as { projectName: string };
          setProjects((prev) => prev.filter((p) => p.name !== payload.projectName));
          if (payload.projectName === currentSelected) {
            setSelectedProject(null);
            setProjectState(null);
          }
          break;
        }
        default:
          break;
      }
    },
    [selectedProjectRef, fetchProjectList],
  );

  const { status: sseStatus, reconnect } = useSSE({
    url: "/api/events",
    onEvent: handleSSEEvent,
  });

  const fetchProjectState = useCallback(async (name: string) => {
    setProjectState(null);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(name)}/state`);

      if (res.ok) {
        const data = await res.json();
        setProjectState(data.state);
      } else if (res.status === 404) {
        setProjectState(null);
      } else if (res.status === 422) {
        const data = await res.json();
        setProjectState(null);
        setError(data.error ?? "Malformed state.json");
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        setError(data.error ?? `Unexpected error (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch project state");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectProject = useCallback(
    (name: string) => {
      setSelectedProject(name);
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch {
        // localStorage may be unavailable
      }
      fetchProjectState(name);
    },
    [fetchProjectState]
  );

  // Fetch project list on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/projects", { cache: "no-store" });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Unknown error" }));
          if (!cancelled) {
            setError(data.error ?? `Failed to fetch projects (${res.status})`);
            setIsLoading(false);
          }
          return;
        }

        const data = await res.json();
        const fetchedProjects: ProjectSummary[] = data.projects ?? [];

        if (cancelled) return;

        setProjects(fetchedProjects);

        // Restore selected project from localStorage
        let restored: string | null = null;
        try {
          restored = localStorage.getItem(STORAGE_KEY);
        } catch {
          // localStorage may be unavailable
        }

        if (
          restored &&
          fetchedProjects.some((p) => p.name === restored)
        ) {
          setSelectedProject(restored);
          // Fetch the state for the restored project
          try {
            const stateRes = await fetch(
              `/api/projects/${encodeURIComponent(restored)}/state`
            );

            if (cancelled) return;

            if (stateRes.ok) {
              const stateData = await stateRes.json();
              setProjectState(stateData.state);
            } else if (stateRes.status === 404) {
              setProjectState(null);
            } else if (stateRes.status === 422) {
              const stateData = await stateRes.json();
              setProjectState(null);
              setError(stateData.error ?? "Malformed state.json");
            } else {
              const stateData = await stateRes
                .json()
                .catch(() => ({ error: "Unknown error" }));
              setError(
                stateData.error ?? `Unexpected error (${stateRes.status})`
              );
            }
          } catch (err) {
            if (!cancelled) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Failed to fetch project state"
              );
            }
          }
        }

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch projects"
          );
          setIsLoading(false);
        }
      }
    }

    fetchProjects();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    projects,
    selectedProject,
    projectState,
    selectProject,
    isLoading,
    error,
    sseStatus,
    reconnect,
  };
}
