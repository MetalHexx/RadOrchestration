import fs from 'node:fs';
import path from 'node:path';

export function loadManifest(pluginRoot, version) {
  const p = path.join(pluginRoot, 'manifests', `v${version}.json`);
  if (!fs.existsSync(p)) throw new Error(`manifest not found for v${version} at ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
