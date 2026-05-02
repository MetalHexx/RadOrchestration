import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

/**
 * Resolves the install-time orchRoot from the filesystem signal — the
 * folder name four levels above this lib file:
 *   <install>/<orchRoot>/skills/rad-orchestration/scripts/lib/orch-root.ts
 *
 * Returns the orchRoot directory name (the folder name immediately under
 * the install root, e.g. the harness directory) so that library code in
 * scripts/lib/ can derive harness-aware paths without hardcoding any
 * particular install root name.
 */
export function detectOrchRoot(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // scripts/lib/ → scripts/ → rad-orchestration/ → skills/ → <orchRoot>/
  return basename(resolve(__dirname, '..', '..', '..', '..'));
}
