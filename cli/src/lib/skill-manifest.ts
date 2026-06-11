import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface SkillEntry {
  name: string;
  description: string;
  path: string;
  /** The registry repo name this skill was discovered in (FR-18). Present when
   *  the entry was produced by `buildSkillManifestPerRepo`; absent on plain
   *  `buildSkillManifest` results so the existing interface stays backward-compatible. */
  repo?: string;
}

export interface BuildSkillManifestOptions {
  repoRoot: string;
  warn?: (msg: string) => void;
}

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'prompt-tests',
]);

function* walkSkillFiles(root: string): Generator<string> {
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (EXCLUDED_DIRS.has(e.name)) continue;
        stack.push(path.join(dir, e.name));
      } else if (e.isFile() && e.name === 'SKILL.md') {
        yield path.join(dir, e.name);
      }
    }
  }
}

type ParsedFrontmatter =
  | { error: string; frontmatter?: undefined }
  | { error?: undefined; frontmatter: Record<string, unknown> };

function parseFrontmatter(text: string): ParsedFrontmatter {
  if (!text.startsWith('---')) return { error: 'no frontmatter block' };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { error: 'frontmatter not terminated' };
  const raw = text.slice(3, end);
  const fm: Record<string, unknown> = {};
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) return { error: `malformed line: ${line}` };
    const rawValue = m[2]!.trim();
    const wasQuoted = rawValue.length >= 2 && (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    );
    let value: unknown;
    if (wasQuoted) value = rawValue.slice(1, -1);
    else if (rawValue === 'true') value = true;
    else if (rawValue === 'false') value = false;
    else value = rawValue;
    fm[m[1]!] = value;
  }
  return { frontmatter: fm };
}

export function buildSkillManifest(opts: BuildSkillManifestOptions): SkillEntry[] {
  const warn = opts.warn ?? ((msg: string) => process.stderr.write(msg + '\n'));
  const out: SkillEntry[] = [];
  for (const file of walkSkillFiles(opts.repoRoot)) {
    let text: string;
    try { text = readFileSync(file, 'utf8'); }
    catch (err) { warn(`warn: ${file}: ${(err as Error).message}`); continue; }
    const parsed = parseFrontmatter(text);
    if (parsed.error) { warn(`warn: ${file}: ${parsed.error}`); continue; }
    const fm = parsed.frontmatter!;
    const name = fm['name'];
    const description = fm['description'];
    if (typeof name !== 'string' || !name) { warn(`warn: ${file}: missing name`); continue; }
    if (typeof description !== 'string' || !description) { warn(`warn: ${file}: missing description`); continue; }
    if (name.startsWith('rad-')) continue;
    if (fm['disable-model-invocation'] === true) continue;
    out.push({ name, description, path: path.resolve(file) });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface BuildSkillManifestPerRepoOptions {
  repos: Array<{ name: string; root: string }>;
  warn?: (msg: string) => void;
}

/**
 * Run `buildSkillManifest` for every supplied repo and tag each returned entry
 * with the repo name it came from (FR-18). Results from all repos are
 * concatenated and sorted by name ascending. A repo that yields no eligible
 * skills simply contributes nothing to the output — it is not an error.
 */
export function buildSkillManifestPerRepo(opts: BuildSkillManifestPerRepoOptions): SkillEntry[] {
  const { repos, warn } = opts;
  const combined: SkillEntry[] = [];
  for (const repo of repos) {
    const entries = buildSkillManifest({ repoRoot: repo.root, warn });
    for (const entry of entries) {
      combined.push({ ...entry, repo: repo.name });
    }
  }
  combined.sort((a, b) => a.name.localeCompare(b.name));
  return combined;
}
