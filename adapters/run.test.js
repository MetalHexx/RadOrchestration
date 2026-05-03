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
  assert.strictEqual(result.skillCount, 2, 'returns skill count (SKILL.md + 1 reference file)');
  assert.strictEqual(result.fileCount, 3, 'returns total file count');
  const manifest = JSON.parse(fs.readFileSync(path.join(out, 'fake', 'manifest.json'), 'utf8'));
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

test('runAdapter writes manifest as a sibling of the bundle dir, keyed on adapter.name', async () => {
  const canonical = fixtureCanonical();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'out-'));
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
  // Manifest lives under <outputRoot>/<adapter.name>/manifest.json.
  assert.ok(
    fs.existsSync(path.join(out, 'fake', 'manifest.json')),
    'manifest.json must be written under outputRoot/<adapter.name>/',
  );
  // The bundle dir must NOT contain a manifest.json — that would collide for
  // adapters sharing a targetDir (e.g. copilot-vscode + copilot-cli on .github/).
  assert.ok(
    !fs.existsSync(path.join(out, '.fake', 'manifest.json')),
    'manifest.json must not be inside the bundle dir',
  );
});
