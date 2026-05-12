import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the CLI's package.json by walking up from this file's location
 * until it finds the first package.json whose name is '@rad-orchestration/cli'.
 *
 * This avoids fragile relative-path math from createRequire, which would need
 * different `..` counts depending on whether the file runs from source (e.g.
 * Vitest) or from the compiled `dist/cli/src/...` tree (with `rootDir: "../"`
 * the cli's tsc outputs preserve repo-level relativity).
 */
function findCliPackageJson(): { version: string } {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  // Bound the walk so a misconfigured tree fails loudly rather than infinitely.
  for (let i = 0; i < 12; i += 1) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { name?: string; version?: string };
        if (parsed.name === '@rad-orchestration/cli' && typeof parsed.version === 'string') {
          return { version: parsed.version };
        }
      } catch {
        // Try the next ancestor — a malformed JSON shouldn't halt the walk.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Unable to locate @rad-orchestration/cli package.json from ' + fileURLToPath(import.meta.url));
}

let cached: { version: string } | undefined;
export function getCliVersion(): string {
  if (!cached) cached = findCliPackageJson();
  return cached.version;
}
