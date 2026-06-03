import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const typesSrc = readFileSync(join(__dirname, 'types.ts'), 'utf-8');
const navSrc = readFileSync(
  join(__dirname, '..', 'layout', 'app-header-shell.tsx'), 'utf-8');

test('types.ts declares the client read shapes (AD-8)', () => {
  assert.match(typesSrc, /export\s+type\s+BindState\s*=\s*'unbound'\s*\|\s*'bound'\s*\|\s*'missing'/);
  assert.match(typesSrc, /export\s+interface\s+RepoRead/);
  assert.match(typesSrc, /export\s+interface\s+RepoGroupRead/);
  assert.match(typesSrc, /export\s+interface\s+RegistrySnapshot/);
});

test('types.ts never imports node:fs or the registry library (NFR-1)', () => {
  assert.doesNotMatch(typesSrc, /node:fs/);
  assert.doesNotMatch(typesSrc, /@rad-orchestration\/repo-registry/);
  assert.doesNotMatch(typesSrc, /lib\/registry\/validate/);
});

test('nav registers a "Repo Registry" entry between Projects and Process Editor (FR-1, DD-9)', () => {
  assert.match(navSrc, /label:\s*"Repo Registry",\s*href:\s*"\/repo-registry"/);
  const projects = navSrc.indexOf('"Projects"');
  const registry = navSrc.indexOf('"Repo Registry"');
  const process = navSrc.indexOf('"Process Editor"');
  assert.ok(projects < registry && registry < process,
    'Repo Registry must sit between Projects and Process Editor');
});
