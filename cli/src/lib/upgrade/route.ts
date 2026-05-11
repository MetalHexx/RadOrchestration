import path from 'node:path';
import { userDataPaths } from './user-data-paths.js';
import { harnessRoot } from './harness-paths.js';
import type { HarnessName } from './harness-paths.js';

/**
 * Path-prefix routing for a bundle-relative path. `agents/` and `skills/`
 * route to the harness's user-level scope; everything else routes under
 * `~/.radorch/`. Single source of truth consumed by install, upgrade, and
 * uninstall.
 */
export function resolveBundleTarget(bundlePath: string, harness: HarnessName): string {
  const normalized = bundlePath.split(/[\\/]/).join('/');
  if (normalized.startsWith('agents/') || normalized.startsWith('skills/')) {
    return path.join(harnessRoot(harness), ...normalized.split('/'));
  }
  return path.join(userDataPaths().root, ...normalized.split('/'));
}
