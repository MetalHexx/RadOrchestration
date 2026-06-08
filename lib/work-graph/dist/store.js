import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
const STORE_FILE = 'work-graph.yml';
const CURRENT_VERSION = 1;
export class GraphIndex {
    root;
    constructor(root) {
        this.root = root;
    }
    get file() { return path.join(this.root, STORE_FILE); }
    read() {
        if (!fs.existsSync(this.file)) {
            return { version: CURRENT_VERSION, rev: 0, groups: {}, edges: [] };
        }
        let raw;
        try {
            raw = yaml.load(fs.readFileSync(this.file, 'utf8'));
        }
        catch (cause) {
            throw new Error(`failed to parse ${this.file}: ${cause}`);
        }
        const obj = (raw ?? {});
        return {
            version: obj.version ?? CURRENT_VERSION,
            rev: obj.rev ?? 0,
            groups: obj.groups ?? {},
            edges: obj.edges ?? [],
        };
    }
    // A stale `expectedRev` is an anticipated compare-and-swap conflict, so it is returned as a
    // value (and nothing is written). Genuine fs faults (temp write / rename) still throw — no
    // caller can recover from them.
    write(graph, expectedRev) {
        const current = this.read();
        if (current.rev !== expectedRev) {
            return { ok: false, error: { code: 'stale_revision', message: `stale revision: expected ${expectedRev} but store is at ${current.rev}` } };
        }
        const next = {
            version: CURRENT_VERSION,
            rev: expectedRev + 1,
            groups: graph.groups,
            edges: graph.edges,
        };
        const tmp = this.file + '.tmp';
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(tmp, yaml.dump({ version: next.version, rev: next.rev, groups: next.groups, edges: next.edges }, { indent: 2, lineWidth: 80, noRefs: true }), 'utf8');
        fs.renameSync(tmp, this.file);
        return { ok: true, data: next };
    }
}
//# sourceMappingURL=store.js.map