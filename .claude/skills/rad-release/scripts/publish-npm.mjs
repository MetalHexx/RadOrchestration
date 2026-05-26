import { spawnSync } from 'node:child_process';
import path from 'node:path';

export async function publishNpm({ repoRoot, spawn = spawnSync }) {
  // npm publish runs from harness-installers/standard/ (NOT output/) because
  // the publish package.json lives at standard/package.json — see
  // harness-installers/standard/build-scripts/{build,validate}.js.
  const cwd = path.join(repoRoot, 'harness-installers/standard');
  const res = spawn('npm', ['publish', '--access', 'public'], { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    return { ok: false, error: res.stderr || 'npm publish failed' };
  }
  return { ok: true, stdout: res.stdout };
}
