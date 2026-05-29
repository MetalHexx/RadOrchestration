// In-process catalog/shipped helpers for the action-events UI surface.
//
// This module is a deliberate transplant of the parsing/derivation logic from
// `cli/src/lib/pipeline-engine/action-event-loader.ts` and
// `cli/src/lib/pipeline-engine/composer.ts`. The CLI remains the canonical
// implementation; the UI keeps a local copy so the dashboard's catalog and
// shipped routes can stay in-process (no subprocess spawn per file read).
//
// Drift risk: the compose route still shells out to `radorch action-events
// compose` — that path exercises the same frontmatter shapes end-to-end, so
// any divergence between this parser and the canonical one would surface as a
// Preview output mismatch. Pair with `ui/lib/action-events-fs.test.ts`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

// ── Types (mirror cli/src/lib/pipeline-engine/action-event-loader.ts) ─────────

export type ActionEventKind = 'action' | 'event';
export type ActionCategory = 'agent-spawn' | 'gate' | 'terminal' | 'source-control';

export interface ActionFrontmatter {
  kind: 'action';
  name: string;
  title: string;
  description: string;
  category: ActionCategory;
  completion_event: string | null;
}

export interface EventFrontmatter {
  kind: 'event';
  name: string;
  title: string;
  description: string;
  signal_payload: Record<string, { required: boolean; description: string }>;
}

export type Frontmatter = ActionFrontmatter | EventFrontmatter;

export interface ParsedActionEvent {
  kind: ActionEventKind;
  name: string;
  frontmatter: Frontmatter;
  body: string;
}

// ── Parser (mirror cli/src/lib/pipeline-engine/action-event-loader.ts) ────────

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const FILENAME_RE = /^(action|event)\.([a-z0-9_]+)\.md$/;
const CATEGORIES = new Set<ActionCategory>(['agent-spawn', 'gate', 'terminal', 'source-control']);

export function parseActionEventFile(text: string, filename: string): ParsedActionEvent {
  const fnMatch = FILENAME_RE.exec(filename);
  if (!fnMatch) {
    throw new Error(`Invalid catalog filename '${filename}': expected '<action|event>.<name>.md'.`);
  }
  const fileKind = fnMatch[1] as ActionEventKind;
  const fileName = fnMatch[2];

  const fmMatch = FRONTMATTER_RE.exec(text);
  if (!fmMatch) {
    throw new Error(`File '${filename}' missing YAML frontmatter block.`);
  }
  const raw = parseYaml(fmMatch[1]) as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`File '${filename}' has empty or non-object frontmatter.`);
  }

  if (raw['kind'] !== fileKind) {
    throw new Error(`File '${filename}' frontmatter.kind '${String(raw['kind'])}' disagrees with filename kind '${fileKind}'.`);
  }
  if (raw['name'] !== fileName) {
    throw new Error(`File '${filename}' frontmatter.name '${String(raw['name'])}' disagrees with filename stem '${fileName}'.`);
  }
  for (const field of ['title', 'description']) {
    if (typeof raw[field] !== 'string' || !(raw[field] as string).length) {
      throw new Error(`File '${filename}' frontmatter.${field} is required and must be a non-empty string.`);
    }
  }

  if (fileKind === 'action') {
    if (!CATEGORIES.has(raw['category'] as ActionCategory)) {
      throw new Error(`File '${filename}' frontmatter.category '${String(raw['category'])}' is not one of ${Array.from(CATEGORIES).join(', ')}.`);
    }
    if (!(raw['completion_event'] === null || typeof raw['completion_event'] === 'string')) {
      throw new Error(`File '${filename}' frontmatter.completion_event must be a string or null.`);
    }
  } else {
    const payload = raw['signal_payload'];
    if (payload === undefined || payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error(`File '${filename}' frontmatter.signal_payload must be an object map (use {} for no flags).`);
    }
    for (const [flag, def] of Object.entries(payload as Record<string, unknown>)) {
      const d = def as Record<string, unknown>;
      if (typeof d?.['required'] !== 'boolean' || typeof d?.['description'] !== 'string') {
        throw new Error(`File '${filename}' signal_payload['${flag}'] must be { required: boolean, description: string }.`);
      }
    }
  }

  const body = fmMatch[2] ?? '';
  return { kind: fileKind, name: fileName, frontmatter: raw as unknown as Frontmatter, body };
}

// ── Signal-line derivation (mirror cli/src/lib/pipeline-engine/composer.ts) ───

export function deriveSignalLine(eventName: string, fm: EventFrontmatter): string {
  const keys = Object.keys(fm.signal_payload ?? {});
  if (keys.length === 0) return `Signal: ${eventName}`;
  const flags = keys.map((k) => `--${k} <value>`).join(' ');
  return `Signal: ${eventName} ${flags}`;
}

// ── Catalog root resolution ───────────────────────────────────────────────────
// Mirrors cli/src/lib/paths.ts#userDataPaths().actionEvents. Tests stub
// os.homedir() via ui/lib/test-helpers.ts#withHomedir to redirect this.

export function resolveCatalogRoot(): string {
  return path.join(os.homedir(), '.radorc', 'action-events');
}

// ── Catalog / shipped read APIs ───────────────────────────────────────────────

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
  is_orphan: boolean;
}

export function listCatalogEntries(catalogRoot: string): CatalogEntry[] {
  if (!fs.existsSync(catalogRoot)) return [];
  const customRoot = path.join(catalogRoot, 'custom');
  const files = fs.readdirSync(catalogRoot).filter((f) => /^(action|event)\..+\.md$/.test(f));
  const parsed: Array<{ filename: string; entry: ParsedActionEvent }> = [];
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
        is_orphan: false,
      });
    } else {
      const ef = fm as EventFrontmatter;
      const isOrphan = !referencedCompletionEvents.has(p.entry.name);
      // Orphan events expose only the post slot — the engine wires that
      // content as a preamble on the next action's prompt when the orphan
      // event fires. Pre stays hidden (no specific signalling agent to
      // address). Non-orphan events keep both pre and post.
      const applicable = isOrphan ? 1 : 2;
      let populated = 0;
      if (!isOrphan && fs.existsSync(path.join(customRoot, `event.${p.entry.name}.pre.md`))) populated++;
      if (fs.existsSync(path.join(customRoot, `event.${p.entry.name}.post.md`))) populated++;
      out.push({
        kind: 'event',
        name: p.entry.name,
        title: ef.title,
        description: ef.description,
        signal_payload: ef.signal_payload,
        signal_line: deriveSignalLine(p.entry.name, ef),
        applicable_slot_count: applicable,
        populated_slot_count: populated,
        is_orphan: isOrphan,
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
  const fm = parsed.frontmatter as ActionFrontmatter | EventFrontmatter;
  const base: ShippedRead = { kind: parsed.kind, name: parsed.name, title: fm.title, description: fm.description, body: parsed.body };
  if (parsed.kind === 'action') {
    const af = fm as ActionFrontmatter;
    base.category = af.category;
    base.completion_event = af.completion_event ?? null;
  } else {
    const ef = fm as EventFrontmatter;
    base.signal_payload = ef.signal_payload;
    base.signal_line = deriveSignalLine(parsed.name, ef);
  }
  return base;
}
