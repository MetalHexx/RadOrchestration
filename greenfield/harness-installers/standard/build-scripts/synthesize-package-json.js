// synthesize-package-json.js — Produces output/package.json for publish from
// the standard installer's source-side wrapper package.json. Overrides the
// publish-critical fields (name, bin, files, engines, dependencies) and
// carries the metadata fields verbatim. The source wrapper itself never
// publishes; only output/ does.

import fs from 'node:fs';
import path from 'node:path';

const VERBATIM_FIELDS = [
  'description', 'author', 'license', 'homepage',
  'repository', 'bugs', 'keywords',
];

/**
 * @param {{ sourcePkgPath: string, outPath: string }} opts
 */
export function synthesizePackageJson({ sourcePkgPath, outPath }) {
  const pkg = JSON.parse(fs.readFileSync(sourcePkgPath, 'utf8'));
  const out = {
    name: 'rad-orchestration',
    version: pkg.version,
    type: 'module',
    bin: { 'radorch-installer': 'index.js' },
    engines: { node: '>=18' },
    dependencies: pkg.dependencies ?? {},
    files: ['index.js', 'lib/', 'output/', 'manifests/'],
  };
  for (const field of VERBATIM_FIELDS) {
    if (pkg[field] !== undefined) out[field] = pkg[field];
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
}
