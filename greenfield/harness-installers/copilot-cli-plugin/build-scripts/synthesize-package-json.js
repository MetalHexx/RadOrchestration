import fs from 'node:fs';
import path from 'node:path';

/** Produces output/package.json from wrapper package.json + plugin.json.
 *  plugin.json's version always wins. Published name is @rad-orchestration/copilot-cli-plugin (FR-31). */
export function synthesizePackageJson({ wrapperPath, pluginJsonPath, outPath }) {
  const wrapper = JSON.parse(fs.readFileSync(wrapperPath, 'utf8'));
  const pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  const out = {
    name: '@rad-orchestration/copilot-cli-plugin',
    version: pluginJson.version,
    description: wrapper.description ?? 'Copilot CLI marketplace plugin for rad-orchestration.',
    license: wrapper.license ?? 'MIT',
    type: 'module',
    files: [
      'plugin.json', 'agents/', 'skills/', 'hooks/',
      'manifests/', 'orchestration.yml', 'templates/', 'ui/',
    ],
    engines: wrapper.engines ?? { node: '>=20' },
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
}
