import fs from 'node:fs';
import path from 'node:path';
import { rollupProjectStatus } from './status.js';
import { resolveWorktrees } from './worktrees.js';
export function listProjectNames(projectsDir) {
    if (!fs.existsSync(projectsDir))
        return [];
    return fs.readdirSync(projectsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b));
}
export function projectExists(projectsDir, name) {
    return fs.existsSync(path.join(projectsDir, name));
}
function readState(dir) {
    const file = path.join(dir, 'state.json');
    if (!fs.existsSync(file))
        return null;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
}
function scanDocs(dir, name) {
    const docs = { others: [] };
    const slots = {
        [`${name}-BRAINSTORMING.md`]: 'brainstorming',
        [`${name}-REQUIREMENTS.md`]: 'requirements',
        [`${name}-MASTER-PLAN.md`]: 'masterPlan',
    };
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isFile() || entry.name === 'state.json')
            continue;
        const slot = slots[entry.name];
        if (slot)
            docs[slot] = entry.name;
        else
            docs.others.push(entry.name);
    }
    docs.others.sort((a, b) => a.localeCompare(b));
    return docs;
}
export function deriveProject(name, deps) {
    const dir = path.join(deps.projectsDir, name);
    if (!fs.existsSync(dir))
        return null;
    const state = readState(dir);
    const sc = state?.pipeline?.source_control;
    return {
        id: name, kind: 'project', name,
        status: state ? rollupProjectStatus(state) : 'unknown',
        dir,
        tier: state?.pipeline?.current_tier ?? null,
        projectType: state?.project?.project_type === 'side-project' ? 'side-project' : 'standard',
        sourceControlInitialized: !!sc && typeof sc === 'object' && !Array.isArray(sc),
        docs: scanDocs(dir, name),
        worktrees: resolveWorktrees(name, deps),
    };
}
//# sourceMappingURL=projects.js.map