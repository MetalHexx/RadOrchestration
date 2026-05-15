#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const outFile = outArg
  ? outArg.slice('--out='.length)
  : path.join(cliRoot, 'dist-bundle', 'radorch.mjs');

if (outArg && !outFile) {
  process.stderr.write('bundle: --out= requires a non-empty path\n');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

// Compile TypeScript once via tsc to get dist/ for esbuild's entry resolution.
const { execSync } = await import('node:child_process');
execSync('npx tsc', { cwd: cliRoot, stdio: 'inherit' });

// Read the version from package.json at bundle time so it can be inlined.
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const VERSION = pkg.version;

// The cli source uses a runtime walk (lib/package-version.ts → getCliVersion())
// because the post-rootDir-widening tsc output sits deeper in dist/ than before,
// breaking the old createRequire-relative path math. At bundle time we replace
// that walk with the inlined version so the bundle is fully self-contained.
const PKG_VERSION_FILE_SUFFIX = path.join('dist', 'cli', 'src', 'lib', 'package-version.js');

// Plugin: inline cli version in the package-version module so the bundled
// radorch.mjs never needs to fs-walk for cli/package.json at runtime.
const inlineVersionPlugin = {
  name: 'inline-version',
  setup(b) {
    b.onLoad({ filter: /package-version\.js$/ }, async (loadArgs) => {
      if (!loadArgs.path.endsWith(PKG_VERSION_FILE_SUFFIX)) {
        return null;
      }
      const inlined = `export function getCliVersion() { return ${JSON.stringify(VERSION)}; }\n`;
      return { contents: inlined, loader: 'js' };
    });
  },
};

// Banner: provide a real require() for CJS dependencies (e.g. commander) that use
// dynamic require('node:...') — needed when bundling CJS packages into an ESM output.
const banner = `
import { createRequire as __cjsRequireHelper } from 'node:module';
const require = __cjsRequireHelper(import.meta.url);
`;

await build({
  entryPoints: [path.join(cliRoot, 'dist', 'cli', 'src', 'bin', 'radorch.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: outFile,
  banner: { js: banner },
  // Inline every dep — no externals, no runtime npm install (NFR-2).
  external: [],
  // Suppress dynamic-require warnings from commander/inquirer.
  logLevel: 'warning',
  plugins: [inlineVersionPlugin],
});

fs.chmodSync(outFile, 0o755);
process.stderr.write(`bundled → ${outFile}\n`);
