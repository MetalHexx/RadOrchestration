import * as fs from 'fs';
import * as yaml from 'js-yaml';
import type {
  NodeDef,
  PipelineTemplate,
  EventIndex,
  EventIndexEntry,
  LoadedTemplate,
} from './types.js';

function buildEventIndex(nodes: NodeDef[], parentPath: string): EventIndex {
  const index = new Map<string, EventIndexEntry>();

  for (const node of nodes) {
    const templatePath = parentPath === '' ? node.id : `${parentPath}.${node.id}`;

    if (node.kind === 'step') {
      const startedEvent = node.events.started;
      const completedEvent = node.events.completed;

      if (index.has(startedEvent)) {
        throw new Error(`Duplicate event name in template: ${startedEvent}`);
      }
      if (index.has(completedEvent)) {
        throw new Error(`Duplicate event name in template: ${completedEvent}`);
      }

      index.set(startedEvent, { nodeDef: node, eventPhase: 'started', templatePath });
      index.set(completedEvent, { nodeDef: node, eventPhase: 'completed', templatePath });
    } else if (node.kind === 'gate') {
      const approvedEvent = node.approved_event;

      if (index.has(approvedEvent)) {
        throw new Error(`Duplicate event name in template: ${approvedEvent}`);
      }

      index.set(approvedEvent, { nodeDef: node, eventPhase: 'approved', templatePath });
    } else if (node.kind === 'for_each_phase') {
      const childIndex = buildEventIndex(node.body, `${templatePath}.body`);
      for (const [eventName, entry] of childIndex) {
        if (index.has(eventName)) {
          throw new Error(`Duplicate event name in template: ${eventName}`);
        }
        index.set(eventName, entry);
      }
    } else if (node.kind === 'for_each_task') {
      const childIndex = buildEventIndex(node.body, `${templatePath}.body`);
      for (const [eventName, entry] of childIndex) {
        if (index.has(eventName)) {
          throw new Error(`Duplicate event name in template: ${eventName}`);
        }
        index.set(eventName, entry);
      }
    } else if (node.kind === 'conditional') {
      const trueIndex = buildEventIndex(node.branches.true, `${templatePath}.branches.true`);
      for (const [eventName, entry] of trueIndex) {
        if (index.has(eventName)) {
          throw new Error(`Duplicate event name in template: ${eventName}`);
        }
        index.set(eventName, entry);
      }
      const falseIndex = buildEventIndex(node.branches.false, `${templatePath}.branches.false`);
      for (const [eventName, entry] of falseIndex) {
        if (index.has(eventName)) {
          throw new Error(`Duplicate event name in template: ${eventName}`);
        }
        index.set(eventName, entry);
      }
    } else if (node.kind === 'parallel') {
      const childIndex = buildEventIndex(node.children, `${templatePath}.children`);
      for (const [eventName, entry] of childIndex) {
        if (index.has(eventName)) {
          throw new Error(`Duplicate event name in template: ${eventName}`);
        }
        index.set(eventName, entry);
      }
    } else {
      const _exhaustive: never = node;
      throw new Error(`Unexpected node kind in template: ${(_exhaustive as NodeDef).kind}`);
    }
  }

  return index;
}

export function loadTemplate(templatePath: string): LoadedTemplate {
  let raw: string;
  try {
    raw = fs.readFileSync(templatePath, 'utf-8');
  } catch (err) {
    if (err !== null && typeof err === 'object' && (err as { code?: unknown }).code === 'ENOENT') {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid YAML in template: ${templatePath}: ${message}`);
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Malformed template: missing template');
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj['template'] || typeof obj['template'] !== 'object') {
    throw new Error('Malformed template: missing template');
  }

  const header = obj['template'] as Record<string, unknown>;

  if (!header['id'] || typeof header['id'] !== 'string') {
    throw new Error('Malformed template: missing template.id');
  }
  if (!header['version'] || typeof header['version'] !== 'string') {
    throw new Error('Malformed template: missing template.version');
  }
  if (!header['description'] || typeof header['description'] !== 'string') {
    throw new Error('Malformed template: missing template.description');
  }

  if (!obj['nodes'] || !Array.isArray(obj['nodes']) || obj['nodes'].length === 0) {
    throw new Error('Malformed template: missing nodes');
  }

  const template = parsed as PipelineTemplate;
  const eventIndex = buildEventIndex(template.nodes, '');

  return { template, eventIndex };
}
