// adapters/destination-routing.js — Single source of truth for "where does a
// file go on the user's machine." Pure function; emits a templated string
// containing `${HARNESS_ROOT}` or `${RAD_HOME}` tokens that consumers
// (installer, in-skill CLI) expand at install time.
//
// Routing rules (evaluated in order):
//   bundlePath matches `skills/rad-orchestration/templates/<name>.yml`
//                                                → ${RAD_HOME}/templates/<name>.yml
//   bundlePath starts with `agents/` or `skills/` → ${HARNESS_ROOT}/<bundlePath>
//   everything else                               → ${RAD_HOME}/<bundlePath>
//
// Token meaning (consumer expands):
//   ${HARNESS_ROOT} → ~/.claude for claude, ~/.copilot for copilot-vscode and copilot-cli
//   ${RAD_HOME}     → ~/.radorch (always)

// Matches the four tier-classification template files staged under the rad-orchestration
// skill bundle path. The adapter stages these files at skills/rad-orchestration/templates/
// during the build but routes their *destination* to ~/.radorch/templates/ so they land
// in the shared user-data root. All other skills' templates/ subfolders stay in the harness
// skill folder.
const TIER_TEMPLATE_RE = /^skills\/rad-orchestration\/templates\/([^/]+\.yml)$/;

/**
 * Computes the templated destination path for a manifest entry's bundlePath.
 * @param {string} bundlePath - Forward-slash relative path inside the bundle
 *   (e.g. "skills/rad-orchestration/scripts/radorch.mjs" or "ui/server.js")
 * @param {string} _harness - Harness name. Currently unused in the routing
 *   decision (the choice is path-prefix-based, not harness-based) but kept in
 *   the signature so the API is symmetric with consumer-side token expansion
 *   and ready for harness-specific routing if ever needed.
 * @returns {string} templated path, e.g. "${HARNESS_ROOT}/skills/foo"
 */
export function resolveDestinationPath(bundlePath, _harness) {
  const normalized = bundlePath.split(/[\\/]/).join('/');
  // Special case: tier-classification templates route to ~/.radorch/templates/
  // so they land alongside projects and logs where users can customize them.
  // Only the rad-orchestration skill's templates/ subfolder qualifies — other
  // skills' templates/ folders (rad-brainstorm, rad-log-error, etc.) are
  // skill-local and stay in the harness skill folder.
  const tierMatch = TIER_TEMPLATE_RE.exec(normalized);
  if (tierMatch) {
    return `\${RAD_HOME}/templates/${tierMatch[1]}`;
  }
  if (normalized.startsWith('agents/') || normalized.startsWith('skills/')) {
    return `\${HARNESS_ROOT}/${normalized}`;
  }
  return `\${RAD_HOME}/${normalized}`;
}
