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

export function selectBrainstormingArtifacts(projectName: string, fileList: string[]): Artifact[] {
  return deriveArtifacts(projectName, fileList);
}

export function useProjectArtifacts(projectName: string | null, fileList: string[]): Artifact[] {
  return useMemo(
    () => (projectName ? deriveArtifacts(projectName, fileList) : []),
    [projectName, fileList],
  );
}

