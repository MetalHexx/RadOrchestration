import fs from 'node:fs';
import path from 'node:path';

export const INSTALL_LOG_ACTIONS = Object.freeze(new Set([
  'fresh-install', 'upgrade-complete', 'noop',
  'downgrade-noop', 'cancelled-modified-files', 'error',
]));

/** Best-effort append; never throws to caller (NFR-10). */
export function appendInstallLog(file, { action, deliveringVersion, installedVersionBefore }, opts = {}) {
  const { mkdirAncestors = true } = opts;
  try {
    if (!INSTALL_LOG_ACTIONS.has(action)) {
      throw new Error(`install-log: unknown action ${action}`);
    }
    const entry = {
      at: new Date().toISOString(),
      channel: 'claude-plugin',
      action,
      delivering_version: deliveringVersion,
      installed_version_before: installedVersionBefore ?? null,
    };
    if (mkdirAncestors) fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
  } catch {
    /* best-effort; NFR-10 */
  }
}
