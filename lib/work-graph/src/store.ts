import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import type { StoredGraph } from './types.js';

const STORE_FILE = 'work-graph.yml';
const CURRENT_VERSION = 1;

export class StaleRevisionError extends Error {
  constructor(public readonly expected: number, public readonly actual: number) {
    super(`stale revision: expected ${expected} but store is at ${actual}`);
    this.name = 'StaleRevisionError';
  }
}

export class GraphIndex {
  constructor(private readonly root: string) {}
  private get file(): string { return path.join(this.root, STORE_FILE); }

  read(): StoredGraph {
    if (!fs.existsSync(this.file)) {
      return { version: CURRENT_VERSION, rev: 0, groups: {}, edges: [] };
    }
    let raw: unknown;
    try { raw = yaml.load(fs.readFileSync(this.file, 'utf8')); }
    catch (cause) { throw new Error(`failed to parse ${this.file}: ${cause}`); }
    const obj = (raw ?? {}) as Partial<StoredGraph>;
    return {
      version: obj.version ?? CURRENT_VERSION,
      rev: obj.rev ?? 0,
      groups: obj.groups ?? {},
      edges: obj.edges ?? [],
    };
  }

  write(graph: StoredGraph, expectedRev: number): StoredGraph {
    const current = this.read();
    if (current.rev !== expectedRev) throw new StaleRevisionError(expectedRev, current.rev);
    const next: StoredGraph = {
      version: CURRENT_VERSION,
      rev: expectedRev + 1,
      groups: graph.groups,
      edges: graph.edges,
    };
    const tmp = this.file + '.tmp';
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, yaml.dump(
      { version: next.version, rev: next.rev, groups: next.groups, edges: next.edges },
      { indent: 2, lineWidth: 80, noRefs: true },
    ), 'utf8');
    fs.renameSync(tmp, this.file);
    return next;
  }
}
