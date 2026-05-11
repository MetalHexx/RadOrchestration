export { readInstallJson, writeInstallJson } from '../config.js';
import { readInstallJson, writeInstallJson } from '../config.js';
import { pathExists } from '../fs-helpers.js';

/**
 * Atomically stamp last_writer_version and — on first install only — set installed_at.
 * If the file does not exist, this is a no-op.
 */
export async function stampLastWriter(installJsonPath: string, version: string): Promise<void> {
  if (!(await pathExists(installJsonPath))) return;
  const ij = await readInstallJson(installJsonPath);
  ij.last_writer_version = version;
  if (!ij.installed_at) {
    ij.installed_at = new Date().toISOString();
  }
  await writeInstallJson(installJsonPath, ij);
}
