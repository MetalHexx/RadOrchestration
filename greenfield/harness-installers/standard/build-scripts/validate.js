import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REQUIRED_PER_HARNESS = [
  'orchestration.yml',
  'templates/extra-high.yml',
  'templates/high.yml',
  'templates/medium.yml',
  'templates/low.yml',
  'skills/rad-orchestration/scripts/radorch.mjs',
  'skills/rad-orchestration/scripts/pipeline.js',
  'skills/rad-orchestration/scripts/explode-master-plan.js',
];

const SIZE_LIMIT = Math.round(50 * 1024 * 1024 * 1.1);

function defaultSizer(outputDir) {
  const out = execSync('npm pack --dry-run --json', {
    cwd: outputDir, shell: process.platform === 'win32', encoding: 'utf8',
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

  // Gate 2: every canonical agent appears at output/<harness>/agents/<name>.md.
  const canonical = fs.readdirSync(canonicalAgentsDir)
    .filter((f) => f.endsWith('.md') && !f.includes('.copilot.') && !f.includes('.claude.'))
    .map((f) => path.basename(f));
  for (const h of harnesses) {
    for (const filename of canonical) {
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
