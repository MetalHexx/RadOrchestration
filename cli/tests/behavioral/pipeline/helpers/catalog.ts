// cli/tests/behavioral/pipeline/helpers/catalog.ts
//
// Behavioral-test helper for pointing the engine composer at a real or copied
// action/event catalog. Behavioral tests under `events/` exercise the engine
// via the CLI surface (pipelineSignalCommand → processEvent), so they share
// a single `__setActionEventsRootForTests` hook with the engine.
//
// Two modes are supported:
//   - `useRealCatalog()` — points the engine at `runtime-config/action-events/`
//     so composer reads catalog files committed at HEAD. Read-only path.
//   - `useTempCatalogCopy()` — snapshots the real catalog into an OS temp dir
//     so tests can author custom-slot files or mutate action frontmatter
//     without contaminating the working tree.
//
// Both return a `restore()` thunk that resets the engine override to null
// (production path) and removes any temp dir.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { __setActionEventsRootForTests } from '../../../../src/lib/pipeline-engine/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Absolute path to `<repo>/runtime-config/action-events/`. Resolved by
 *  walking up from this helper file (cli/tests/behavioral/pipeline/helpers/).
 *  Six segments up lands on the repo root. */
export function realCatalogRoot(): string {
  return path.resolve(__dirname, '..', '..', '..', '..', '..', 'runtime-config', 'action-events');
}

/** Point the engine composer at the real catalog under runtime-config/.
 *  Returns a restore thunk that clears the override. */
export function useRealCatalog(): () => void {
  const root = realCatalogRoot();
  __setActionEventsRootForTests(root);
  return () => { __setActionEventsRootForTests(null); };
}

function copyDirRecursive(src: string, dst: string): void {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

/** Snapshot the real catalog into a temp dir, point the engine at it, and
 *  return `{ root, restore }`. The temp dir is removed on restore. */
export function useTempCatalogCopy(): { root: string; restore: () => void } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'behavioral-catalog-'));
  copyDirRecursive(realCatalogRoot(), root);
  __setActionEventsRootForTests(root);
  return {
    root,
    restore: () => {
      __setActionEventsRootForTests(null);
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
