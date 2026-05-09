#!/usr/bin/env node
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const outArg = args.find((a) => a.startsWith('--out='));
const outFile = outArg
  ? outArg.slice('--out='.length)
  : path.join(__dirname, 'dist-bundle', 'pipeline.js');

fs.mkdirSync(path.dirname(outFile), { recursive: true });

await build({
  entryPoints: [path.join(__dirname, 'pipeline.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: outFile,
  banner: { js: '#!/usr/bin/env node' },
  external: [],
  logLevel: 'warning',
  loader: { '.json': 'json' },
});
fs.chmodSync(outFile, 0o755);
process.stderr.write(`bundled → ${outFile}\n`);
