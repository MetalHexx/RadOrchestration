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

// Loose "looks like a URL" check. Deliberately lenient to match what the
// registry already supports (the server preserves scheme-less remotes like
// `github.com/acme/repo` and does not coerce them — see normalizeRemote). After
// previewRemote (trim, strip one .git, ssh→https), accept any of:
//   - a scheme URL:      https://… ssh://… git://… file://…
//   - scp-style ssh:     git@host:owner/repo
//   - a dotted host:     github.com  or  github.com/owner/repo
//   - localhost:         localhost[:port][/path]
//   - a host/path form:  internalhost/repo  (no dot, but clearly a path)
// Reject empty, whitespace-containing, or hostless garbage like `'''`, `r`, `hhh`.
// The bias is intentionally toward acceptance: the server stores any remote, so a
// false-reject would trap a user from saving an existing repo, while a
// false-accept is harmless. Does NOT check reachability.
const REMOTE_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i;
const REMOTE_SCP_RE = /^[^\s@]+@[^\s:]+:[^\s]+$/;
const REMOTE_HOST_RE = /^[^\s/@]+\.[^\s/@]+(\/[^\s]*)?$/;
const REMOTE_LOCALHOST_RE = /^localhost(:\d+)?(\/[^\s]*)?$/i;
const REMOTE_PATH_RE = /^[^\s/@]+\/[^\s]+$/;

export function isRemoteUrlValid(raw: string): boolean {
  const r = previewRemote(raw);
  if (r === '' || /\s/.test(r)) return false;
  return REMOTE_SCHEME_RE.test(r)
    || REMOTE_SCP_RE.test(r)
    || REMOTE_HOST_RE.test(r)
    || REMOTE_LOCALHOST_RE.test(r)
    || REMOTE_PATH_RE.test(r);
}

// Proper-Case field labels shared by client + server error wording.
export const FIELD_LABELS: Record<string, string> = {
  slug: 'Slug',
  remote: 'Remote',
  defaultBranch: 'Default Branch',
  description: 'Description',
  localPath: 'Local Path',
};

export function requiredMessage(field: string): string {
  return `${FIELD_LABELS[field] ?? field} is required.`;
}

export const SLUG_FORMAT_MESSAGE = 'Slug must be lowercase-kebab — letters, numbers, and single hyphens.';
export const REMOTE_URL_MESSAGE = 'Remote must be a valid URL, e.g. https://github.com/org/repo.';
