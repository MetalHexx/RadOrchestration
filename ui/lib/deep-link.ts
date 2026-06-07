export function buildDocDeepLink(origin: string, projectName: string, fileName: string): string {
  return `${origin}/projects/${encodeURIComponent(projectName)}/docs/${encodeURIComponent(fileName)}`;
}
