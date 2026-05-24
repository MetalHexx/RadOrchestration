import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

export const REQUIRED_PER_HARNESS = [
  'orchestration.yml',
  'templates/extra-high.yml',
  'templates/high.yml',
  'templates/medium.yml',
  'templates/low.yml',
  'skills/rad-orchestration/scripts/radorch.mjs',
];

const SIZE_LIMIT = Math.round(50 * 1024 * 1024 * 1.1);

function defaultSizer(outputDir) {
  // npm pack runs from the source-side `standard/` (one level up from `output/`)
  // because the publish package.json lives at `standard/package.json`. Sizing the
  // tarball must happen from the same cwd.
  const out = execSync('npm pack --dry-run --json', {
    cwd: path.dirname(outputDir), shell: process.platform === 'win32', encoding: 'utf8',
  });
  const parsed = JSON.parse(out);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  return { unpackedSize: entry?.unpackedSize ?? entry?.size ?? 0 };
}

/** @param {{ outputDir: string, canonicalAgentsDir: string, harnesses: string[], version: string, sizer?: (d:string)=>{unpackedSize:number} }} opts */
export function validatePackageTree(opts) {
  const { outputDir, canonicalAgentsDir, harnesses, version } = opts;
  const sizer = opts.sizer ?? defaultSizer;

  // Gate 1: required per-harness artifacts.
  for (const h of harnesses) {
    for (const rel of REQUIRED_PER_HARNESS) {
      if (!fs.existsSync(path.join(outputDir, h, rel))) {
        throw new Error(`validate: missing required artifact ${h}/${rel} (gate 1)`);
      }
    }
  }

  // Gate 2: every canonical agent appears at output/<harness>/agents/<name><suffix>,
  // where the suffix matches the adapter's documented filename rule for that
  // harness — claude emits `<name>.md`, copilot variants emit `<name>.agent.md`.
  const COPILOT_AGENT_SUFFIX_HARNESSES = new Set(['copilot-vscode', 'copilot-cli']);
  const canonicalNames = fs.readdirSync(canonicalAgentsDir)
    .filter((f) => f.endsWith('.md') && !f.includes('.copilot.') && !f.includes('.claude.'))
    .map((f) => f.replace(/\.md$/, ''));
  for (const h of harnesses) {
    const suffix = COPILOT_AGENT_SUFFIX_HARNESSES.has(h) ? '.agent.md' : '.md';
    for (const name of canonicalNames) {
      const filename = `${name}${suffix}`;
      if (!fs.existsSync(path.join(outputDir, h, 'agents', filename))) {
        throw new Error(`validate: missing ${h}/agents/${filename} (gate 2)`);
      }
    }
  }

  // Gate 3: per-harness manifest present at output/<harness>/manifests/v<version>.json.
  for (const h of harnesses) {
    const manifestRel = `manifests/v${version}.json`;
    if (!fs.existsSync(path.join(outputDir, h, manifestRel))) {
      throw new Error(`validate: missing ${h}/${manifestRel} (gate 3)`);
    }
  }

  // Gate 4: tarball size budget.
  const { unpackedSize } = sizer(outputDir);
  if (unpackedSize > SIZE_LIMIT) {
    throw new Error(`validate: unpacked size ${unpackedSize} exceeds size budget of ${SIZE_LIMIT} bytes (gate 4)`);
  }
}
