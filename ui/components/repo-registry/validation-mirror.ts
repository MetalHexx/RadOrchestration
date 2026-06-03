const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isSlugValid(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function isRequiredFilled(value: string): boolean {
  return value.trim() !== '';
}

export function isLocalPathFilled(value: string): boolean {
  return value.trim() !== '';
}

// Mirrors the server normalizeRemote: trim, strip a single trailing .git,
// convert git@host:owner/repo SSH shorthand to https://host/owner/repo.
// Every other form is left unchanged.
export function previewRemote(raw: string): string {
  let r = raw.trim().replace(/\.git$/, '');
  const ssh = r.match(/^git@([^:]+):(.+)$/);
  if (ssh) r = `https://${ssh[1]}/${ssh[2]}`;
  return r;
}
