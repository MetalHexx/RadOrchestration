// adapters/run.test.js — Runner emits transformed bundle + per-file metadata stream.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runAdapter } from './run.js';

function fixtureCanonical() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-'));
  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'skills', 'rad-demo', 'references'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'agents', 'sample.md'),
    '---\nname: sample\ndescription: Sample\nmodel: opus\ntools: Read, Bash\n---\nbody\n',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'skills', 'rad-demo', 'SKILL.md'),
    '---\nname: rad-demo\ndescription: Demo\n---\nbody\n',
    'utf8',
  );
  fs.writeFileSync(path.join(dir, 'skills', 'rad-demo', 'references', 'r.md'), 'ref body', 'utf8');
  return dir;
}

const fakeAdapter = {
  name: 'fake',
  targetDir: '.fake',
  filenameRule: ({ kind, canonicalName }) =>
    kind === 'agent' ? `${canonicalName}.agent.md` : 'SKILL.md',
  agentFrontmatter: (c) => ({ ...c, model: 'fake-' + c.model }),
  skillFrontmatter: (c) => ({ ...c }),
  toolDictionary: { Read: 'read', Bash: 'execute' },
  modelAliases: { haiku: 'fake-haiku', sonnet: 'fake-sonnet', opus: 'fake-opus' },
};

test('runAdapter writes transformed agents under <outputRoot>/<targetDir>/agents/', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  const written = fs.readFileSync(path.join(out, '.fake', 'agents', 'sample.agent.md'), 'utf8');
  assert.match(written, /model: fake-opus/);
  assert.match(written, /\nbody\n/);
});

test('runAdapter copies skill subfolders verbatim', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  const ref = fs.readFileSync(path.join(out, '.fake', 'skills', 'rad-demo', 'references', 'r.md'), 'utf8');
  assert.strictEqual(ref, 'ref body');
});

test('runAdapter emits manifest.json with one entry per emitted file', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  const result = await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  assert.strictEqual(result.agentCount, 1, 'returns agent count');
  assert.strictEqual(result.skillCount, 1, 'skillCount counts distinct skill directories, not files');
  assert.strictEqual(result.fileCount, 3, 'returns total file count');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(out, 'fake', 'manifests', 'v1.2.3.json'), 'utf8'),
  );
  const paths = manifest.files.map((f) => f.bundlePath).sort();
  assert.deepStrictEqual(paths, [
    'agents/sample.agent.md',
    'skills/rad-demo/SKILL.md',
    'skills/rad-demo/references/r.md',
  ]);
  const agentEntry = manifest.files.find((f) => f.bundlePath === 'agents/sample.agent.md');
  assert.strictEqual(agentEntry.ownership, 'orchestration-system');
  assert.strictEqual(agentEntry.version, '1.2.3');
  assert.strictEqual(agentEntry.harness, 'fake');
  assert.strictEqual(agentEntry.sourcePath, 'agents/sample.md');
});

test('runAdapter emits per-file output only when BUILD_VERBOSE=1', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  const messages = [];
  const origLog = console.log;
  console.log = (msg) => { messages.push(String(msg)); };
  try {
    delete process.env.BUILD_VERBOSE;
    await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
    assert.strictEqual(messages.length, 0, 'no per-file output when env var unset');

    process.env.BUILD_VERBOSE = '1';
    await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
    assert.ok(messages.length > 0, 'verbose mode prints per-file output');
  } finally {
    console.log = origLog;
    delete process.env.BUILD_VERBOSE;
  }
});

test('runAdapter applies frontmatter projection to agents with CRLF line endings', async () => {
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-crlf-'));
  fs.mkdirSync(path.join(canonical, 'agents'), { recursive: true });
  // Write agent file with Windows CRLF line endings.
  const crlf = '---\r\nname: sample\r\ndescription: Sample\r\nmodel: opus\r\ntools: Read, Bash\r\n---\r\nbody\r\n';
  fs.writeFileSync(path.join(canonical, 'agents', 'sample.md'), crlf, 'utf8');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-crlf-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.0.0' });
  const written = fs.readFileSync(path.join(out, '.fake', 'agents', 'sample.agent.md'), 'utf8');
  assert.match(written, /model: fake-opus/, 'agentFrontmatter projection must have run');
  assert.doesNotMatch(written, /model: opus/, 'original tier alias must not survive unchanged');
});

test('runAdapter applies frontmatter projection to skills with CRLF line endings', async () => {
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-crlf-skill-'));
  fs.mkdirSync(path.join(canonical, 'skills', 'rad-demo'), { recursive: true });
  // Write SKILL.md with Windows CRLF line endings.
  const crlf = '---\r\nname: rad-demo\r\ndescription: Demo\r\n---\r\nbody\r\n';
  fs.writeFileSync(path.join(canonical, 'skills', 'rad-demo', 'SKILL.md'), crlf, 'utf8');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-crlf-skill-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.0.0' });
  const written = fs.readFileSync(path.join(out, '.fake', 'skills', 'rad-demo', 'SKILL.md'), 'utf8');
  assert.match(written, /name: rad-demo/, 'skill frontmatter must be present in output');
});

test('runAdapter scopes its wipe to agents/ and skills/ — sibling content under targetRoot survives', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-scoped-'));
  // Pre-seed sibling content the build must NEVER touch.
  const targetRoot = path.join(out, '.fake');
  fs.mkdirSync(path.join(targetRoot, 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'workflows', 'ci.yml'), 'jobs: {}\n', 'utf8');
  fs.writeFileSync(path.join(targetRoot, 'AGENTS.md'), '# user-owned\n', 'utf8');
  // Pre-seed a stale agents/ file that MUST be wiped.
  fs.mkdirSync(path.join(targetRoot, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(targetRoot, 'agents', 'stale.md'), 'stale\n', 'utf8');

  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });

  // Sibling content survived.
  assert.ok(fs.existsSync(path.join(targetRoot, 'workflows', 'ci.yml')), 'sibling workflow file must survive scoped wipe');
  assert.ok(fs.existsSync(path.join(targetRoot, 'AGENTS.md')), 'sibling AGENTS.md must survive scoped wipe');
  // Stale agents/ file was wiped before re-emit.
  assert.ok(!fs.existsSync(path.join(targetRoot, 'agents', 'stale.md')), 'stale agents/ content must be wiped');
  // Fresh agents/ was emitted.
  assert.ok(fs.existsSync(path.join(targetRoot, 'agents', 'sample.agent.md')), 'fresh agents/ must be emitted');
});

test('runAdapter writes manifest into per-version catalog at <adapter.name>/manifests/v<version>.json', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-cat-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  // New canonical location.
  const manifestPath = path.join(out, 'fake', 'manifests', 'v1.2.3.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest must live at <outputRoot>/<adapter.name>/manifests/v<version>.json');
  // Legacy single-file location must NOT be re-emitted.
  assert.ok(
    !fs.existsSync(path.join(out, 'fake', 'manifest.json')),
    'legacy <adapter.name>/manifest.json must not be written',
  );
  // Bundle dir must NOT contain a manifest.json — would collide on shared targetDir adapters.
  assert.ok(!fs.existsSync(path.join(out, '.fake', 'manifest.json')), 'manifest must not be inside the bundle dir');
});

test('runAdapter preserves prior version manifests in the catalog directory', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-cat-prior-'));
  const catalogDir = path.join(out, 'fake', 'manifests');
  fs.mkdirSync(catalogDir, { recursive: true });
  const priorBody = JSON.stringify({ harness: 'fake', version: '1.0.0-alpha.9', files: [] }, null, 2) + '\n';
  fs.writeFileSync(path.join(catalogDir, 'v1.0.0-alpha.9.json'), priorBody, 'utf8');
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.0.0-alpha.10' });
  // Prior version preserved.
  assert.ok(fs.existsSync(path.join(catalogDir, 'v1.0.0-alpha.9.json')), 'prior catalog entry must be preserved');
  // New version added.
  assert.ok(fs.existsSync(path.join(catalogDir, 'v1.0.0-alpha.10.json')), 'new catalog entry must be added');
});

test('runAdapter manifest entries carry sha256 hash of the emitted file content', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-hash-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  const manifest = JSON.parse(
    fs.readFileSync(path.join(out, 'fake', 'manifests', 'v1.2.3.json'), 'utf8'),
  );
  const crypto = await import('node:crypto');
  for (const entry of manifest.files) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `entry ${entry.bundlePath} must have hex sha256`);
    const onDisk = fs.readFileSync(path.join(out, '.fake', entry.bundlePath));
    const expected = crypto.createHash('sha256').update(onDisk).digest('hex');
    assert.strictEqual(entry.sha256, expected, `sha256 must match emitted file content for ${entry.bundlePath}`);
  }
});

test('runAdapter rewrites system.orch_root and stamps package_version in per-bundle orchestration.yml', async () => {
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-yml-'));
  // Mirror the canonical layout: skills/rad-orchestration/config/orchestration.yml
  const cfgDir = path.join(canonical, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(canonical, 'skills', 'rad-orchestration', 'SKILL.md'),
    '---\nname: rad-orchestration\ndescription: Orchestration\n---\nbody\n', 'utf8');
  fs.writeFileSync(
    path.join(cfgDir, 'orchestration.yml'),
    'version: "1.0"\nsystem:\n  orch_root: .claude\nprojects:\n  base_path: orchestration-projects\n  naming: SCREAMING_CASE\n',
    'utf8',
  );
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-yml-'));
  await runAdapter(
    { ...fakeAdapter, targetDir: '.github' },
    { canonicalRoot: canonical, outputRoot: out, version: '1.0.0-alpha.9', packageVersion: '1.0.0-alpha.9' },
  );
  const written = fs.readFileSync(
    path.join(out, '.github', 'skills', 'rad-orchestration', 'config', 'orchestration.yml'),
    'utf8',
  );
  // system.orch_root rewritten to adapter.targetDir (without leading dot is acceptable; we match either form).
  assert.match(written, /orch_root:\s*\.github/, 'system.orch_root must be rewritten to adapter.targetDir');
  // New package_version stamped at top, after `version: "1.0"`, before `system:`.
  assert.match(
    written,
    /version:\s*"?1\.0"?\s*\npackage_version:\s*1\.0\.0-alpha\.9\s*\nsystem:/,
    'package_version must be stamped between schema version and system block',
  );
  // Other fields pass through verbatim.
  assert.match(written, /base_path:\s*orchestration-projects/);
  assert.match(written, /naming:\s*SCREAMING_CASE/);
});

test('runAdapter marks the orchestration.yml manifest entry as ownership=user-config', async () => {
  // Regression: the installer overwrites orchestration.yml with
  // generateConfig(userConfig) at install time, so the bundled bytes never
  // match the installed bytes. Marking the entry as user-config is the
  // signal to detectModifiedFiles to skip the entry and avoid surfacing a
  // false-positive modified-file warning on every upgrade/uninstall. Other
  // skill subfiles must keep ownership=orchestration-system.
  const canonical = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-own-'));
  const cfgDir = path.join(canonical, 'skills', 'rad-orchestration', 'config');
  fs.mkdirSync(cfgDir, { recursive: true });
  fs.writeFileSync(path.join(canonical, 'skills', 'rad-orchestration', 'SKILL.md'),
    '---\nname: rad-orchestration\ndescription: Orchestration\n---\nbody\n', 'utf8');
  fs.writeFileSync(
    path.join(cfgDir, 'orchestration.yml'),
    'version: "1.0"\nsystem:\n  orch_root: .claude\n',
    'utf8',
  );
  // Sibling skill subfile to verify ownership doesn't leak to other entries.
  fs.mkdirSync(path.join(canonical, 'skills', 'rad-orchestration', 'references'), { recursive: true });
  fs.writeFileSync(
    path.join(canonical, 'skills', 'rad-orchestration', 'references', 'r.md'),
    'reference body\n',
    'utf8',
  );
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-own-'));
  await runAdapter(
    { ...fakeAdapter, targetDir: '.github' },
    { canonicalRoot: canonical, outputRoot: out, version: '1.0.0-alpha.9', packageVersion: '1.0.0-alpha.9' },
  );
  const manifest = JSON.parse(fs.readFileSync(
    path.join(out, 'fake', 'manifests', 'v1.0.0-alpha.9.json'), 'utf8',
  ));
  const ymlEntry = manifest.files.find(
    (f) => f.bundlePath === 'skills/rad-orchestration/config/orchestration.yml',
  );
  assert.ok(ymlEntry, 'orchestration.yml entry must be present in manifest');
  assert.strictEqual(ymlEntry.ownership, 'user-config',
    'orchestration.yml ownership must be user-config so the hash check skips it');
  const refEntry = manifest.files.find(
    (f) => f.bundlePath === 'skills/rad-orchestration/references/r.md',
  );
  assert.ok(refEntry, 'reference subfile entry must be present');
  assert.strictEqual(refEntry.ownership, 'orchestration-system',
    'sibling skill subfiles must remain orchestration-system ownership');
});
