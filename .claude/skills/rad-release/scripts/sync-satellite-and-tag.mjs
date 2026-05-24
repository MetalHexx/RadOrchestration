import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const PLUGINS = [
  { src: 'harness-installers/claude-plugin/output', dest: 'claude-plugin' },
  { src: 'harness-installers/copilot-cli-plugin/output', dest: 'copilot-cli-plugin' },
  { src: 'harness-installers/copilot-vscode-plugin/output', dest: 'copilot-vscode-plugin' },
];

function defaultCopyTree(from, to) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function defaultRewriteCatalogRef(catalogPath, ref) {
  const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  for (const p of cat.plugins) p.source.ref = ref;
  fs.writeFileSync(catalogPath, JSON.stringify(cat, null, 2) + '\n');
}

export async function syncSatelliteAndTag({
  repoRoot, satelliteRoot, version,
  spawn = spawnSync, copyTree = defaultCopyTree, rewriteCatalogRef = defaultRewriteCatalogRef,
}) {
  const tag = `v${version}`;
  // 1. Replace each plugin payload directory in the satellite (AD-5)
  for (const { src, dest } of PLUGINS) {
    copyTree(path.join(repoRoot, src), path.join(satelliteRoot, dest));
  }
  // 2. Update both marketplace catalogs' refs to the new release tag (AD-2, AD-5)
  rewriteCatalogRef(path.join(satelliteRoot, '.claude-plugin', 'marketplace.json'), tag);
  rewriteCatalogRef(path.join(satelliteRoot, '.github', 'plugin', 'marketplace.json'), tag);
  // 3. Commit the satellite checkout (AD-5)
  spawn('git', ['add', '-A'], { cwd: satelliteRoot, encoding: 'utf8' });
  spawn('git', ['commit', '-m', `release: ${tag}`], { cwd: satelliteRoot, encoding: 'utf8' });
  // 4. Tag both repos with the matching v{X} (FR-7, FR-8)
  spawn('git', ['tag', tag], { cwd: repoRoot, encoding: 'utf8' });
  spawn('git', ['tag', tag], { cwd: satelliteRoot, encoding: 'utf8' });
  // 5. Push both repos and both tags (NFR-6: no CI involved; operator's local creds drive)
  spawn('git', ['push', 'origin', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' });
  spawn('git', ['push', 'origin', tag], { cwd: repoRoot, encoding: 'utf8' });
  spawn('git', ['push', 'origin', 'HEAD'], { cwd: satelliteRoot, encoding: 'utf8' });
  spawn('git', ['push', 'origin', tag], { cwd: satelliteRoot, encoding: 'utf8' });
}
