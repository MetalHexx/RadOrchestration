import { readInstallJson, writeInstallJson } from './config.js';
import { pathExists } from './fs-helpers.js';

function cmpSemver(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const pb = b.split(/[.-]/).map((p) => /^\d+$/.test(p) ? Number(p) : p);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (typeof x === 'number' && typeof y === 'number') {
      if (x !== y) return x < y ? -1 : 1;
    } else {
      const sx = String(x);
      const sy = String(y);
      if (sx !== sy) return sx < sy ? -1 : 1;
    }
  }
  return 0;
}

export async function stampLastWriter(installJsonPath: string, version: string): Promise<void> {
  if (!(await pathExists(installJsonPath))) return;
  const ij = await readInstallJson(installJsonPath);
  if (cmpSemver(version, ij.last_writer_version) >= 0) {
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
  if (cmpSemver(opts.localVersion, ij.last_writer_version) < 0) {
    return {
      ok: false,
      message: `state was last written by radorch ${ij.last_writer_version} in another harness's plugin; this plugin has ${opts.localVersion} — update via /plugin update rad-orchestration in the harness that wrote it`,
    };
  }
  return { ok: true };
}
