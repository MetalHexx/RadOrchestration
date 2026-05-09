import { readInstallJson, writeInstallJson } from './config.js';
import { pathExists } from './fs-helpers.js';

// Semver-aware comparator that respects pre-release precedence (SemVer §11):
// a normal release > any pre-release of the same main version (e.g. 1.0.0 > 1.0.0-alpha.8).
// Returns -1 / 0 / +1 in the usual sign convention.
export function cmpSemver(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i];
    const y = pb[i];
    // Side that ran out of tokens: if the other side's next token is a string,
    // it's a pre-release tag — the side without one is the release and wins.
    if (x === undefined) return typeof y === 'string' ? 1 : -1;
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else if (typeof x === 'number') {
      // numeric token meets pre-release tag at same position: release > pre-release
      return 1;
    } else if (typeof y === 'number') {
      return -1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

export async function stampLastWriter(installJsonPath: string, version: string): Promise<void> {
  if (!(await pathExists(installJsonPath))) return;
  const ij = await readInstallJson(installJsonPath);
  // No-op fallback: if last_writer_version is absent (old schema), just stamp it.
  if (!ij.last_writer_version || cmpSemver(version, ij.last_writer_version) >= 0) {
    ij.last_writer_version = version;
    await writeInstallJson(installJsonPath, ij);
  }
}

export async function checkVersionSkew(opts: {
  installJsonPath: string;
  localVersion: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await pathExists(opts.installJsonPath))) return { ok: true };
  const ij = await readInstallJson(opts.installJsonPath);
  // No-op fallback: if last_writer_version is absent (old schema), skip the check.
  if (!ij.last_writer_version) return { ok: true };
  if (cmpSemver(opts.localVersion, ij.last_writer_version) < 0) {
    return {
      ok: false,
      message: `state was last written by radorch ${ij.last_writer_version} in another harness's plugin; this plugin has ${opts.localVersion} — update via /plugin update rad-orchestration in the harness that wrote it`,
    };
  }
  return { ok: true };
}
