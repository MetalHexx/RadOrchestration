import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// FR-29: REQUIRED_ARTIFACTS. plugin.json at payload root (no .claude-plugin/),
// and the agent filename suffix on gate 2 is .agent.md (Copilot rule). The
// claude-plugin's namespaced-token gate is intentionally DROPPED (AD-10).
const REQUIRED_ARTIFACTS = [
  'plugin.json',
  'package.json',
  'skills/rad-orchestration/scripts/radorch.mjs',
  'skills/rad-orchestration/scripts/pipeline.js',
  'skills/rad-orchestration/scripts/explode-master-plan.js',
  'hooks/hooks.json',
  'hooks/bootstrap.mjs',
  'hooks/drift-check.mjs',
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

/** @param {{ outputDir: string, canonicalAgentsDir: string, sizer?: (d:string)=>{unpackedSize:number} }} opts */
export function validatePluginTree(opts) {
  const { outputDir, canonicalAgentsDir } = opts;
  const sizer = opts.sizer ?? defaultSizer;
  const plugin = JSON.parse(fs.readFileSync(path.join(outputDir, 'plugin.json'), 'utf8'));
  const version = plugin.version;

  // Gate 1: required artifacts present.
  for (const rel of REQUIRED_ARTIFACTS) {
    if (!fs.existsSync(path.join(outputDir, rel))) {
      throw new Error(`validate: missing required artifact ${rel} (gate 1)`);
    }
  }

  // Gate 2: every canonical agent appears at output/agents/<name>.agent.md (Copilot filename suffix).
  // Guard against missing canonicalAgentsDir (e.g. synthetic test fixtures that seed no agents).
  const canonical = fs.existsSync(canonicalAgentsDir)
    ? fs.readdirSync(canonicalAgentsDir)
        .filter((f) => f.endsWith('.md') && !f.includes('.copilot') && !f.includes('.claude.'))
        .map((f) => f.replace(/\.md$/, ''))
    : [];
  for (const name of canonical) {
    if (!fs.existsSync(path.join(outputDir, 'agents', `${name}.agent.md`))) {
      throw new Error(`validate: missing agents/${name}.agent.md (gate 2)`);
    }
  }

  // Gate 3: per-version manifest present.
  const manifestRel = `manifests/v${version}.json`;
  if (!fs.existsSync(path.join(outputDir, manifestRel))) {
    throw new Error(`validate: missing ${manifestRel} (gate 3)`);
  }

  // Gate 4: tarball size budget.
  const { unpackedSize } = sizer(outputDir);
  if (unpackedSize > SIZE_LIMIT) {
    throw new Error(`validate: unpacked size ${unpackedSize} exceeds size budget of ${SIZE_LIMIT} bytes (gate 4)`);
  }
}
