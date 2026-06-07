import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
const IDENTITY = 'repo-registry.yml';
const LOCAL = 'repo-registry.local.yml';
function readYaml(file, fallback) {
    if (!fs.existsSync(file))
        return fallback;
    try {
        return yaml.load(fs.readFileSync(file, 'utf8')) ?? fallback;
    }
    catch (cause) {
        throw new Error(`failed to parse ${file}: ${cause}`);
    }
}
function atomicWrite(file, text) {
    const tmp = file + '.tmp';
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
}
export function readRegistry({ root }) {
    const id = readYaml(path.join(root, IDENTITY), {});
    const local = readYaml(path.join(root, LOCAL), {});
    return { repos: id.repos ?? {}, repoGroups: id.repo_groups ?? {}, localPaths: local.paths ?? {} };
}
export function writeIdentity({ root, repos, repoGroups }) {
    atomicWrite(path.join(root, IDENTITY), yaml.dump({ repos, repo_groups: repoGroups }, { indent: 2, lineWidth: 80, noRefs: true }));
}
export function writeLocal({ root, localPaths }) {
    atomicWrite(path.join(root, LOCAL), yaml.dump({ paths: localPaths }, { indent: 2, noRefs: true }));
    ensureLocalGitignored({ root });
}
export function ensureGitignored({ root, entry }) {
    const gi = path.join(root, '.gitignore');
    const existing = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
    if (existing.split(/\r?\n/).includes(entry))
        return;
    const next = existing && !existing.endsWith('\n') ? existing + '\n' + entry + '\n' : existing + entry + '\n';
    atomicWrite(gi, next);
}
export function ensureLocalGitignored({ root }) {
    ensureGitignored({ root, entry: LOCAL });
}
//# sourceMappingURL=io.js.map