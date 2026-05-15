export { readInstallJson, writeInstallJson } from '../config.js';
import { readInstallJson, writeInstallJson } from '../config.js';
import type { InstallJson, InstallJsonV5, InstallJsonV6, InstallKey, InstallChannel } from '../config.js';
import { pathExists } from '../fs-helpers.js';
import {
  isInstallJsonV6,
  migrateInstallJson,
  detectChannelHeuristic,
  resolveActiveHarnessKey,
} from '../install-json.js';

/**
 * Atomically stamp last_writer_version and — on first install only — set installed_at.
 * If the file does not exist, this is a no-op.
 *
 * v5 inputs are mutated in place at the top level. v6 inputs require an
 * `installKey` to target the per-entry record; without one, every present
 * entry is stamped (mirrors the broad behavior expected by callers that don't
 * know their install identity at stamp time).
 */
export async function stampLastWriter(
  installJsonPath: string,
  version: string,
  installKey?: InstallKey,
): Promise<void> {
  if (!(await pathExists(installJsonPath))) return;
  const ij = await readInstallJson(installJsonPath);
  if (isInstallJsonV6(ij)) {
    if (installKey) {
      const entry = ij.harnesses[installKey];
      if (!entry) return;
      entry.last_writer_version = version;
      if (!entry.installed_at) entry.installed_at = new Date().toISOString();
    } else {
      for (const key of Object.keys(ij.harnesses) as InstallKey[]) {
        const entry = ij.harnesses[key];
        if (!entry) continue;
        entry.last_writer_version = version;
        if (!entry.installed_at) entry.installed_at = new Date().toISOString();
      }
    }
    await writeInstallJson(installJsonPath, ij);
    return;
  }
  const v5 = ij as InstallJsonV5;
  v5.last_writer_version = version;
  if (!v5.installed_at) v5.installed_at = new Date().toISOString();
  await writeInstallJson(installJsonPath, v5);
}

/**
 * Read install.json from disk, lazily migrating v5 → v6 in memory (does NOT
 * write the migrated shape back — caller decides when to persist).
 *
 * Returns undefined if the file is absent. On v5 migration, the channel and
 * active harness key are resolved from filesystem heuristics (see
 * `detectChannelHeuristic` and `resolveActiveHarnessKey`) unless callers
 * supply explicit overrides via `opts`.
 */
export async function readInstallJsonMigrated(
  installJsonPath: string,
  opts?: { activeKey?: InstallKey; channel?: InstallChannel; home?: string },
): Promise<InstallJsonV6 | undefined> {
  if (!(await pathExists(installJsonPath))) return undefined;
  const ij: InstallJson = await readInstallJson(installJsonPath);
  if (isInstallJsonV6(ij)) return ij;
  // v5 → v6: heuristics fill in what the flat record cannot carry.
  const activeKey = opts?.activeKey ?? resolveActiveHarnessKey(opts?.home ? { home: opts.home } : undefined) ?? 'claude';
  const channel = opts?.channel ?? detectChannelHeuristic(opts?.home ? { home: opts.home } : undefined);
  return migrateInstallJson(ij, activeKey, channel);
}

