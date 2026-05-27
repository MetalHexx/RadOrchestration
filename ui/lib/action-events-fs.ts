import fs from 'node:fs';
import path from 'node:path';
import { parseActionEventFile, type ActionFrontmatter, type EventFrontmatter } from '../../cli/src/lib/pipeline-engine/action-event-loader.js';
import { deriveSignalLine } from '../../cli/src/lib/pipeline-engine/composer.js';
import { userDataPaths } from '../../cli/src/lib/paths.js';

// Per AD-10, the catalog root is resolved by the existing
// `userDataPaths().actionEvents` helper from `cli/src/lib/paths.ts`.
// No new path-resolution helper is introduced for this project. Tests
// override the root by stubbing `os.homedir()` (the same convention used
// by `ui/lib/fs-reader-bootstrap.test.ts`).
export function resolveCatalogRoot(): string {
  return userDataPaths().actionEvents;
}

export interface CatalogEntry {
  kind: 'action' | 'event';
  name: string;
  title: string;
  description: string;
  category?: 'agent-spawn' | 'gate' | 'terminal' | 'source-control';
  completion_event?: string | null;
  signal_payload?: Record<string, { required: boolean; description: string }>;
  signal_line?: string;
  applicable_slot_count: number;
  populated_slot_count: number;
}

export function listCatalogEntries(catalogRoot: string): CatalogEntry[] {
  if (!fs.existsSync(catalogRoot)) return [];
  const customRoot = path.join(catalogRoot, 'custom');
  const files = fs.readdirSync(catalogRoot).filter((f) => /^(action|event)\..+\.md$/.test(f));
  const parsed: Array<{ filename: string; entry: ReturnType<typeof parseActionEventFile> }> = [];
  for (const filename of files) {
    try {
      const text = fs.readFileSync(path.join(catalogRoot, filename), 'utf8');
      parsed.push({ filename, entry: parseActionEventFile(text, filename) });
    } catch (err) {
      console.warn(`[action-events] skipping unparseable catalog file '${filename}': ${(err as Error).message}`);
    }
  }
  const referencedCompletionEvents = new Set<string>();
  for (const p of parsed) {
    if (p.entry.kind === 'action') {
      const fm = p.entry.frontmatter as ActionFrontmatter;
      if (fm.completion_event) referencedCompletionEvents.add(fm.completion_event);
    }
  }
  const out: CatalogEntry[] = [];
  for (const p of parsed) {
    const fm = p.entry.frontmatter;
    if (p.entry.kind === 'action') {
      const af = fm as ActionFrontmatter;
      const isTerminal = af.completion_event === null;
      const applicable = isTerminal ? 1 : 3;
      let populated = 0;
      if (fs.existsSync(path.join(customRoot, `action.${p.entry.name}.pre.md`))) populated++;
      if (!isTerminal && af.completion_event) {
        if (fs.existsSync(path.join(customRoot, `event.${af.completion_event}.pre.md`))) populated++;
        if (fs.existsSync(path.join(customRoot, `event.${af.completion_event}.post.md`))) populated++;
      }
      out.push({
        kind: 'action',
        name: p.entry.name,
        title: af.title,
        description: af.description,
        category: af.category,
        completion_event: af.completion_event,
        applicable_slot_count: applicable,
        populated_slot_count: populated,
      });
    } else {
      const ef = fm as EventFrontmatter;
      const isOrphan = !referencedCompletionEvents.has(p.entry.name);
      let populated = 0;
      if (fs.existsSync(path.join(customRoot, `event.${p.entry.name}.pre.md`))) populated++;
      if (fs.existsSync(path.join(customRoot, `event.${p.entry.name}.post.md`))) populated++;
      void isOrphan;
      out.push({
        kind: 'event',
        name: p.entry.name,
        title: ef.title,
        description: ef.description,
        signal_payload: ef.signal_payload,
        signal_line: deriveSignalLine(p.entry.name, ef),
        applicable_slot_count: 2,
        populated_slot_count: populated,
      });
    }
  }
  return out;
}

export interface ShippedRead {
  kind: 'action' | 'event';
  name: string;
  title: string;
  description: string;
  body: string;
  category?: string;
  completion_event?: string | null;
  signal_payload?: Record<string, { required: boolean; description: string }>;
  signal_line?: string;
}

export function readShippedEntry(catalogRoot: string, kind: 'action' | 'event', name: string): ShippedRead | null {
  const filename = `${kind}.${name}.md`;
  const filePath = path.join(catalogRoot, filename);
  if (!fs.existsSync(filePath)) return null;
  const parsed = parseActionEventFile(fs.readFileSync(filePath, 'utf8'), filename);
  const fm = parsed.frontmatter as any;
  const base: ShippedRead = { kind: parsed.kind, name: parsed.name, title: fm.title, description: fm.description, body: parsed.body };
  if (parsed.kind === 'action') {
    base.category = fm.category;
    base.completion_event = fm.completion_event ?? null;
  } else {
    base.signal_payload = fm.signal_payload;
    base.signal_line = deriveSignalLine(parsed.name, fm);
  }
  return base;
}
