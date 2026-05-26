import yaml from 'js-yaml';

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
  const raw = yaml.load(fmMatch[1]) as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`File '${filename}' has empty or non-object frontmatter.`);
  }

  if (raw['kind'] !== fileKind) {
    throw new Error(`File '${filename}' frontmatter.kind '${raw['kind']}' disagrees with filename kind '${fileKind}'.`);
  }
  if (raw['name'] !== fileName) {
    throw new Error(`File '${filename}' frontmatter.name '${raw['name']}' disagrees with filename stem '${fileName}'.`);
  }
  for (const field of ['title', 'description']) {
    if (typeof raw[field] !== 'string' || !(raw[field] as string).length) {
      throw new Error(`File '${filename}' frontmatter.${field} is required and must be a non-empty string.`);
    }
  }

  if (fileKind === 'action') {
    if (!CATEGORIES.has(raw['category'] as ActionCategory)) {
      throw new Error(`File '${filename}' frontmatter.category '${raw['category']}' is not one of ${[...CATEGORIES].join(', ')}.`);
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
