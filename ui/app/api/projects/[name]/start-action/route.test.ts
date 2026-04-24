import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { NextRequest } from 'next/server';

// --- Fixtures ---------------------------------------------------------
const VALID_YAML = `version: "4"
system:
  orch_root: .claude/skills/orchestration
projects:
  base_path: orchestration-projects
  naming: SCREAMING_CASE
limits:
  max_phases: 5
  max_tasks_per_phase: 10
  max_retries_per_task: 2
  max_consecutive_review_rejections: 3
human_gates:
  after_planning: true
  execution_mode: ask
  after_final_review: true
source_control:
  auto_commit: always
  auto_pr: ask
  provider: github
`;

let tmpDir: string;
let projectsDir: string;

async function setup() {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'start-action-'));
  const configDir = path.join(tmpDir, '.claude', 'skills', 'orchestration', 'config');
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, 'orchestration.yml'), VALID_YAML, 'utf-8');
  projectsDir = path.join(tmpDir, 'orchestration-projects');
  await mkdir(path.join(projectsDir, 'DEMO-PROJECT'), { recursive: true });
  process.env.WORKSPACE_ROOT = tmpDir;
  process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN = '1';
  delete process.env.ORCH_ROOT;
}

async function teardown() {
  delete process.env.WORKSPACE_ROOT;
  delete process.env.LAUNCH_CLAUDE_PROJECT_DRY_RUN;
  await rm(tmpDir, { recursive: true, force: true });
}

async function invokePOST(body: unknown, name: string) {
  const { POST } = await import('./route');
  const req = new Request(`http://localhost/api/projects/${name}/start-action`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Next route handlers accept a Request and a context object.
  return POST(req as unknown as NextRequest, { params: { name } });
}

(async () => {
  await setup();
  try {
    // Unknown project → 404
    {
      const res = await invokePOST({ action: 'start-brainstorming' }, 'NOPE');
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.match(json.error, /not found/i);
      console.log('✓ unknown project → 404 not found');
    }

    // Invalid project-name format → 400
    {
      const res = await invokePOST({ action: 'start-brainstorming' }, 'bad..name');
      assert.equal(res.status, 400);
      console.log('✓ invalid project name format → 400');
    }

    // Unknown action → 400
    {
      const res = await invokePOST({ action: 'nope' }, 'DEMO-PROJECT');
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.match(json.error, /action/i);
      console.log('✓ unknown action → 400');
    }

    // Happy path start-brainstorming → 200 success:true platform string
    {
      const res = await invokePOST({ action: 'start-brainstorming' }, 'DEMO-PROJECT');
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(typeof json.platform, 'string');
      console.log('✓ start-brainstorming happy path → 200 success:true platform string');
    }

    // Happy path start-planning → 200 success:true
    {
      const res = await invokePOST({ action: 'start-planning' }, 'DEMO-PROJECT');
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      console.log('✓ start-planning happy path → 200 success:true');
    }

    // WORKSPACE_ROOT unset → 500 with concise error, no absolute path leakage
    {
      const saved = process.env.WORKSPACE_ROOT;
      delete process.env.WORKSPACE_ROOT;
      const res = await invokePOST({ action: 'start-brainstorming' }, 'DEMO-PROJECT');
      process.env.WORKSPACE_ROOT = saved;
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.match(json.error, /workspace/i);
      assert.ok(!/[A-Z]:\\|\/home\//.test(json.error), 'error must not echo absolute host path');
      assert.ok(!/WORKSPACE_ROOT/.test(json.error), 'error must not echo env var name');
      console.log('✓ unset WORKSPACE_ROOT → 500, concise error, no path/env leakage');
    }

    // Forced launcher failure → 500 with structured error, no path leakage
    {
      process.env.LAUNCH_CLAUDE_PROJECT_FORCE_FAIL = '1';
      const res = await invokePOST({ action: 'start-brainstorming' }, 'DEMO-PROJECT');
      delete process.env.LAUNCH_CLAUDE_PROJECT_FORCE_FAIL;
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(typeof json.error, 'string');
      assert.ok(!/[A-Z]:\\|\/home\//.test(json.error), 'error must not echo absolute host path');
      assert.ok(
        !/LAUNCH_CLAUDE_PROJECT_FORCE_FAIL/.test(json.error),
        'error must not echo env var name'
      );
      console.log('✓ forced launcher failure → 500, structured error, no path leakage');
    }

    // projectsDir stays inside tmpDir (teardown safety)
    assert.ok(
      projectsDir.startsWith(tmpDir),
      'projectsDir must be inside tmpDir so teardown does not escape the temp workspace',
    );
    console.log('✓ projectsDir stays inside tmpDir (teardown safety)');

    console.log('\nAll start-action route tests passed');
  } finally {
    await teardown();
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
