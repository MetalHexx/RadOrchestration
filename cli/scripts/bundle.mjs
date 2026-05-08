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
const PKG_INLINE = JSON.stringify({ version: VERSION });

// Pattern matching `const require_ = createRequire(import.meta.url);`
// followed by `const pkg = require_('../../package.json');` (or up to '../../../').
// These appear in compiled output files that load the version at runtime.
// We inline the version at bundle time so the bundle is fully self-contained.
const CJS_PKG_PATTERN =
  /const require_ = createRequire\(import\.meta\.url\);\s*const pkg = require_\(['"]\.\.(\/\.\.){0,2}\/package\.json['"]\)[^;]*;/g;

// Plugin: inline package.json version in any bundled file that uses createRequire to load it.
const inlineVersionPlugin = {
  name: 'inline-version',
  setup(b) {
    b.onLoad({ filter: /\.js$/ }, async (loadArgs) => {
      let src = await fs.promises.readFile(loadArgs.path, 'utf8');
      if (CJS_PKG_PATTERN.test(src)) {
        CJS_PKG_PATTERN.lastIndex = 0;
        src = src
          .replace(/import \{ createRequire \} from ['"]node:module['"];\s*/g, '')
          .replace(CJS_PKG_PATTERN, `const pkg = ${PKG_INLINE};`);
      }
      return { contents: src, loader: 'js' };
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
  entryPoints: [path.join(cliRoot, 'dist', 'bin', 'radorch.js')],
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
