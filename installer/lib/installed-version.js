// installer/lib/installed-version.js — Reads the single piece of on-disk
// state we depend on: `package_version` inside the user's
// <orchRoot>/skills/rad-orchestration/config/orchestration.yml.
//
// Three return shapes:
//   - null                            → orchestration.yml absent (no install)
//   - { packageVersion: null }        → file present, field absent (pre-manifest install)
//   - { packageVersion: '<version>' } → field present (manifest-aware install)

import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} resolvedOrchRoot - Absolute path to <orchRoot>
 * @returns {null | { packageVersion: string | null }}
 */
export function readInstalledPackageVersion(resolvedOrchRoot) {
  const ymlPath = path.join(
    resolvedOrchRoot, 'skills', 'rad-orchestration', 'config', 'orchestration.yml',
  );
  if (!fs.existsSync(ymlPath)) return null;
  const text = fs.readFileSync(ymlPath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*package_version:\s*(.+?)\s*$/);
    if (m) {
      let val = m[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      return { packageVersion: val };
    }
  }
  return { packageVersion: null };
}
