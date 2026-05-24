import { spawnSync } from 'node:child_process';
import { runBuildAndValidate as defaultRun } from './build-and-validate.mjs';

export async function assertReproducible({
  repoRoot,
  runBuildAndValidate = defaultRun,
  spawn = spawnSync,
}) {
  const build = await runBuildAndValidate({ repoRoot, spawn });
  if (!build.ok) return { ok: false, error: 'second-pass build failed: ' + build.error };
  const status = spawn('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  if (status.status !== 0) return { ok: false, error: 'git status failed: ' + status.stderr };
  if (status.stdout.trim()) {
    return { ok: false, error: 'working tree dirty after second build pass — paths: ' + status.stdout.trim() };
  }
  return { ok: true };
}
