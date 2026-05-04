// adapters/discover.js — Folder-convention adapter discovery, no registry file.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/** @import { Adapter } from './types.d.ts' */

/**
 * Discovers every adapter under `adaptersRoot`. An adapter is any direct
 * subfolder whose name does NOT begin with `_` (underscore-prefixed folders
 * are reserved for scaffolds like `_template/`). Each adapter must export
 * `{ adapter }` from its `adapter.js`.
 *
 * @param {string} adaptersRoot - Absolute path to the adapters root folder.
 * @returns {Promise<Adapter[]>} - Discovered adapters in folder-name order.
 */
export async function discoverAdapters(adaptersRoot) {
  const entries = fs.readdirSync(adaptersRoot, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();

  const adapters = [];
  for (const name of folders) {
    const adapterFile = path.join(adaptersRoot, name, 'adapter.js');
    const moduleHref = url.pathToFileURL(adapterFile).href;
    const mod = await import(moduleHref);
    if (!mod.adapter) {
      throw new Error(`adapters/${name}/adapter.js must export 'adapter'`);
    }
    adapters.push(mod.adapter);
  }
  return adapters;
}
