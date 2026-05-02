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
  await runAdapter(fakeAdapter, { canonicalRoot: canonical, outputRoot: out, version: '1.2.3' });
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
