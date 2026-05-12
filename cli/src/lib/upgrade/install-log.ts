import fs from 'node:fs';
import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';

export type InstallLogChannel = 'legacy-installer' | 'claude-plugin';
export type InstallLogAction =
  | 'fresh-install'
  | 'upgrade-complete'
  | 'noop'
  | 'downgrade-noop'
  | 'cancelled-modified-files'
  | 'lock-busy'
  | 'error';

export interface InstallLogInput {
  channel: InstallLogChannel;
  action: InstallLogAction;
  deliveringVersion: string;
  installedVersionBefore: string | null;
}

/**
 * Appends a single JSONL line to ~/.radorch/logs/install.log with the
 * canonical five-field schema (AD-7). Single-line, no pretty-print,
 * field-insertion order is at/channel/action/delivering_version/
 * installed_version_before (DD-3). The write is best-effort: NFR-7
 * guarantees the bootstrap never fails because the log could not be
 * written (e.g. disk full, permission denied).
 */
export function appendInstallLogEntry(input: InstallLogInput): void {
  try {
    const paths = userDataPaths();
    fs.mkdirSync(paths.logs, { recursive: true });
    const entry = {
      at: new Date().toISOString(),
      channel: input.channel,
      action: input.action,
      delivering_version: input.deliveringVersion,
      installed_version_before: input.installedVersionBefore,
    };
    fs.appendFileSync(path.join(paths.logs, 'install.log'), JSON.stringify(entry) + '\n');
  } catch {
    // NFR-7: best-effort; failures are silently swallowed.
  }
}
