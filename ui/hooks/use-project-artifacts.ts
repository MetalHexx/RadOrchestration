"use client";

import { useCallback, useMemo } from "react";
import { deriveArtifacts, type Artifact } from "@/lib/artifact-model";

export async function deleteArtifact(projectName: string, fileName: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectName)}/delete?path=${encodeURIComponent(fileName)}`,
      { method: "POST" },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function useProjectArtifacts(projectName: string | null, fileList: string[]): Artifact[] {
  return useMemo(
    () => (projectName ? deriveArtifacts(projectName, fileList, {}) : []),
    [projectName, fileList],
  );
}

export function useDeleteArtifact(projectName: string | null) {
  return useCallback(
    async (fileName: string) => (projectName ? deleteArtifact(projectName, fileName) : false),
    [projectName],
  );
}
