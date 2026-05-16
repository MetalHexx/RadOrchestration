#!/usr/bin/env node
// bundle.mjs — Build every runtime entry point in `scripts/` to a self-
// contained esbuild ESM bundle.
//
// Invocations:
//   node bundle.mjs                       → bundles ALL entries to in-tree
//                                           defaults (<scriptsDir>/<name>.js).
//   node bundle.mjs --entry=<name>        → bundles only the named entry to
//                                           its in-tree default path.
//   node bundle.mjs --out=<path>          → single-entry write to <path>.
//                                           Defaults entry to `pipeline` for
//                                           backward compatibility with the
//                                           legacy `npm run bundle -- --out=`
//                                           callers in sync-source.js and
//                                           build-plugin.js. Pass
//                                           `--entry=<name> --out=<path>` to
//                                           write a non-default entry to a
//                                           custom path.
//   node bundle.mjs --out-dir=<dir>       → batch write of every entry into
//                                           <dir>/<name>.js.
import { build } from 'esbuild';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Every runtime `.ts` entry that must ship as a self-contained `.js` bundle.
 * Listed centrally so sync-source.js / build-plugin.js / build.js can loop
 * over the same source of truth without re-declaring the set.
 */
export const RUNTIME_ENTRIES = [
  'pipeline',
  'explode-master-plan',
  'migrate-to-v5',
  'fix-ghost-v5',
];

function parseArgs(argv) {
  const get = (name) => {
    const prefix = `--${name}=`;
    const hit = argv.find((a) => a.startsWith(prefix));
    return hit ? hit.slice(prefix.length) : undefined;
  };
  return {
    entry: get('entry'),
    out: get('out'),
    outDir: get('out-dir'),
  };
}

async function bundleOne(entryName, outFile) {
  const entryPoint = path.join(__dirname, `${entryName}.ts`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await build({
    entryPoints: [entryPoint],
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
  try {
    fs.chmodSync(outFile, 0o755);
  } catch {
    // chmod is a no-op on Windows; ignore silently
  }
  process.stderr.write(`bundled → ${outFile}\n`);
}

function defaultOutFor(entryName) {
  return path.join(__dirname, `${entryName}.js`);
}

// Only run when invoked as a script (allow programmatic import of RUNTIME_ENTRIES).
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2));

  if (args.out) {
    // Single-entry, explicit output path. Legacy callers pass only --out= and
    // expect the pipeline entry; preserve that default.
    const entryName = args.entry ?? 'pipeline';
    if (!RUNTIME_ENTRIES.includes(entryName)) {
      throw new Error(`Unknown entry "${entryName}". Known: ${RUNTIME_ENTRIES.join(', ')}`);
    }
    await bundleOne(entryName, args.out);
  } else if (args.entry) {
    // Single-entry, in-tree default output.
    if (!RUNTIME_ENTRIES.includes(args.entry)) {
      throw new Error(`Unknown entry "${args.entry}". Known: ${RUNTIME_ENTRIES.join(', ')}`);
    }
    await bundleOne(args.entry, defaultOutFor(args.entry));
  } else {
    // Batch mode: every entry. --out-dir overrides the in-tree default.
    for (const entryName of RUNTIME_ENTRIES) {
      const outFile = args.outDir
        ? path.join(args.outDir, `${entryName}.js`)
        : defaultOutFor(entryName);
      await bundleOne(entryName, outFile);
    }
  }
}
