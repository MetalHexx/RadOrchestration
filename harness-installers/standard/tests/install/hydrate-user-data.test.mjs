// greenfield/harness-installers/standard/tests/install/hydrate-user-data.test.mjs —
// RED-GREEN tests for hydrateUserData. Each test builds a synthetic tmp dir,
// points HOME / USERPROFILE at a tmp home, and asserts on-disk results.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { hydrateUserData } from '../../lib/install/hydrate-user-data.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Set HOME / USERPROFILE to the given path. Returns a restore function. */
function withHome(home) {
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return () => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
  };
}

/** Build a minimal bundle with orchestration.yml, 4 tier templates, and a ui/ dir. */
function buildBundle(bundleRoot) {
  fs.mkdirSync(bundleRoot, { recursive: true });

  // orchestration.yml in bundle root.
  fs.writeFileSync(path.join(bundleRoot, 'orchestration.yml'), 'model: claude-opus-4-5\n');

  // Four shipped tier templates.
  const templatesDir = path.join(bundleRoot, 'templates');
  fs.mkdirSync(templatesDir, { recursive: true });
  for (const name of ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml']) {
    fs.writeFileSync(path.join(templatesDir, name), `# ${name} bundle content\n`);
  }

  // ui/ bundle with one file.
  const uiDir = path.join(bundleRoot, 'ui');
  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(path.join(uiDir, 'main.js'), '// ui bundle\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('orchestration.yml is copied on fresh install and preserved when already present (FR-14, AD-13)', async () => {
  const tmp = mkTmp('hyd-orch-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    buildBundle(bundle);

    const home = path.join(tmp, 'home');
    const radorch = path.join(home, '.radorch');

    // First call — orchestration.yml absent.
    await hydrateUserData({ bundleRoot: bundle });
    const afterFresh = fs.readFileSync(path.join(radorch, 'orchestration.yml'), 'utf8');
    assert.strictEqual(afterFresh, 'model: claude-opus-4-5\n', 'fresh: bundle content copied');

    // Simulate user editing the file.
    const userContent = 'model: custom-user-model\n';
    fs.writeFileSync(path.join(radorch, 'orchestration.yml'), userContent);

    // Second call — orchestration.yml already present → no-op.
    await hydrateUserData({ bundleRoot: bundle });
    const afterUpgrade = fs.readFileSync(path.join(radorch, 'orchestration.yml'), 'utf8');
    assert.strictEqual(afterUpgrade, userContent, 'upgrade: user-edited orchestration.yml preserved byte-identical');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('four shipped tier files overwrite on every install; user-added templates survive (FR-15, NFR-10, AD-13)', async () => {
  const tmp = mkTmp('hyd-tpl-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    buildBundle(bundle);

    const home = path.join(tmp, 'home');
    const radorch = path.join(home, '.radorch');
    const templatesDir = path.join(radorch, 'templates');

    // Seed stale versions of the four shipped files plus a user-added template.
    fs.mkdirSync(templatesDir, { recursive: true });
    for (const name of ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml']) {
      fs.writeFileSync(path.join(templatesDir, name), '# stale prior version\n');
    }
    fs.writeFileSync(path.join(templatesDir, 'my-custom.yml'), '# user custom template\n');

    await hydrateUserData({ bundleRoot: bundle });

    // Shipped files must have been overwritten with bundle content.
    for (const name of ['extra-high.yml', 'high.yml', 'medium.yml', 'low.yml']) {
      const content = fs.readFileSync(path.join(templatesDir, name), 'utf8');
      assert.strictEqual(content, `# ${name} bundle content\n`, `${name} overwritten with bundle content`);
    }

    // User-added template must survive untouched.
    const customContent = fs.readFileSync(path.join(templatesDir, 'my-custom.yml'), 'utf8');
    assert.strictEqual(customContent, '# user custom template\n', 'my-custom.yml preserved');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('UI bundle copies via tmp-rename: prior ui/ oldfile.js gone, new main.js present (FR-16, AD-9)', async () => {
  const tmp = mkTmp('hyd-ui-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    buildBundle(bundle);

    const home = path.join(tmp, 'home');
    const radorch = path.join(home, '.radorch');

    // Seed a prior ui/ with a file that the new bundle does NOT contain.
    const uiDir = path.join(radorch, 'ui');
    fs.mkdirSync(uiDir, { recursive: true });
    fs.writeFileSync(path.join(uiDir, 'oldfile.js'), '// prior ui artifact\n');

    await hydrateUserData({ bundleRoot: bundle });

    // Old file must be gone.
    assert.strictEqual(
      fs.existsSync(path.join(uiDir, 'oldfile.js')),
      false,
      'prior ui/oldfile.js must be removed after atomic rename',
    );

    // New file from bundle must be present.
    assert.strictEqual(
      fs.existsSync(path.join(uiDir, 'main.js')),
      true,
      'ui/main.js from bundle must exist',
    );
    const content = fs.readFileSync(path.join(uiDir, 'main.js'), 'utf8');
    assert.strictEqual(content, '// ui bundle\n');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('projects/ and logs/ dirs are created if absent (FR-2)', async () => {
  const tmp = mkTmp('hyd-dirs-absent-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    buildBundle(bundle);

    const home = path.join(tmp, 'home');
    const radorch = path.join(home, '.radorch');

    await hydrateUserData({ bundleRoot: bundle });

    assert.strictEqual(fs.existsSync(path.join(radorch, 'projects')), true, 'projects/ created');
    assert.strictEqual(fs.existsSync(path.join(radorch, 'logs')), true, 'logs/ created');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('existing projects/ contents survive hydration (AD-13)', async () => {
  const tmp = mkTmp('hyd-proj-preserve-');
  const restoreHome = withHome(path.join(tmp, 'home'));
  try {
    const bundle = path.join(tmp, 'bundle');
    buildBundle(bundle);

    const home = path.join(tmp, 'home');
    const radorch = path.join(home, '.radorch');

    // Seed an existing project with a state.json.
    const projectDir = path.join(radorch, 'projects', 'MY-PROJECT');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'state.json'), JSON.stringify({ version: 5 }));

    await hydrateUserData({ bundleRoot: bundle });

    // state.json must still be there with original content.
    const stateContent = fs.readFileSync(path.join(projectDir, 'state.json'), 'utf8');
    assert.deepStrictEqual(JSON.parse(stateContent), { version: 5 }, 'project state.json untouched');
  } finally {
    restoreHome();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
