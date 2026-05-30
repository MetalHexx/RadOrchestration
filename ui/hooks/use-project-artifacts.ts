"use client";

import { useMemo } from "react";
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

export function selectBrainstormingArtifacts(projectName: string, fileList: string[], mtimes: Record<string, number> = {}): Artifact[] {
  return deriveArtifacts(projectName, fileList, mtimes);
}

export function useProjectArtifacts(projectName: string | null, fileList: string[], mtimes: Record<string, number> = {}): Artifact[] {
  return useMemo(
    () => (projectName ? deriveArtifacts(projectName, fileList, mtimes) : []),
    [projectName, fileList, mtimes],
  );
}

