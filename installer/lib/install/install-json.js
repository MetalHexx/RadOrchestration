// installer/lib/install/install-json.js — Read/write ~/.radorch/install.json
// and a semver-aware comparator. Independent JS port of
// cli/src/lib/install-json.ts + cli/src/lib/config.ts (the install.json bits).

import fs from 'node:fs';
import path from 'node:path';

export function readInstallJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

export function writeInstallJson(file, value) {
  writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n');
}

function writeFileAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Semver-aware comparator that respects pre-release precedence (SemVer §11):
 * a normal release > any pre-release of the same main version
 * (e.g. 1.0.0 > 1.0.0-alpha.8). Returns -1 / 0 / +1.
 */
export function cmpSemver(a, b) {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === 'number') {
      return 1;
    } else if (typeof y === 'number') {
      return -1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}
