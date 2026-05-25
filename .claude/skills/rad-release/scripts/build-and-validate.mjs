import { spawnSync } from 'node:child_process';
import path from 'node:path';

const PLUGIN_DIRS = [
  'harness-installers/claude-plugin',
  'harness-installers/copilot-cli-plugin',
  'harness-installers/copilot-vscode-plugin',
];

export async function runBuildAndValidate({ repoRoot, spawn = spawnSync }) {
  // Step A: dogfood orchestrator builds all harnesses' agents/skills
  const dogfood = spawn('node', ['harness-dogfood/build.js', '--all'], {
    cwd: repoRoot, encoding: 'utf8',
  });
  if (dogfood.status !== 0) {
    return { ok: false, error: dogfood.stderr || 'dogfood build failed' };
  }
  // Step B: each plugin build runs its own build-scripts/build.js, which
  // invokes its validate.js Gate 3. Validator failure surfaces as
  // build non-zero exit, which halts the flow.
  for (const dir of PLUGIN_DIRS) {
    // Plugin build scripts use `process.cwd()` as their `rootDir`, so they
    // must be invoked from the repo root — running them from inside the
    // plugin dir misresolves the adapter-engine path and fails at step 0.
    const res = spawn('node', [path.posix.join(dir, 'build-scripts/build.js')], {
      cwd: repoRoot, encoding: 'utf8',
    });
    if (res.status !== 0) {
      return { ok: false, error: `${dir} build/validate failed: ${res.stderr}` };
    }
  }
  return { ok: true };
}
