// expand-tokens.js — Walks a file tree, applies destination-token substitution
// and (optionally) agent-namespacing rewrite to every text-extension file in one
// pass, copies binary files verbatim. Installer-blind: every installer-specific
// value (token map, agent names) flows in as a parameter. The text-extension
// list mirrors the engine's at greenfield/harness-adapters/engine/index.js:18
// so the two stay in sync (DD-11).

import fs from 'node:fs';
import path from 'node:path';

const TEXT_EXTS = new Set([
  '.md', '.txt', '.js', '.mjs', '.cjs', '.ts', '.tsx',
  '.json', '.yml', '.yaml', '.sh', '.css', '.html',
]);

function isText(file) {
  return TEXT_EXTS.has(path.extname(file).toLowerCase());
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function substituteTokens(text, tokenMap) {
  let out = text;
  for (const [find, replace] of Object.entries(tokenMap)) {
    out = out.split(find).join(replace);
  }
  return out;
}

function applyNamespacing(text, agentNames) {
  if (!agentNames || agentNames.length === 0) return text;
  const ns = 'rad-orchestration:';
  const escaped = agentNames.slice().sort((a, b) => b.length - a.length).map(escapeRegex);
  const alt = escaped.join('|');
  let out = text;
  // 1. **<name>**
  out = out.replace(new RegExp(`\\*\\*(?:rad-orchestration:)?(${alt})\\*\\*`, 'g'), `**${ns}$1**`);
  // 4. Comma-separated dispatch lists closed by " spawn(s)" or " agent(s)".
  const listEntry = `(?:rad-orchestration:)?(?:${alt})`;
  const listRegex = new RegExp(
    `(?<![\\w:-])(${listEntry}(?:,\\s+(?:and\\s+)?${listEntry})+)(?=\\s+(?:spawns?|agents?)\\b)`,
    'g',
  );
  out = out.replace(listRegex, (match) =>
    match.replace(new RegExp(`(?<![\\w:-])(?:rad-orchestration:)?(${alt})\\b`, 'g'), `${ns}$1`),
  );
  // 2. <name> agent(s)
  out = out.replace(new RegExp(`(?<![\\w:-])(${alt})(?= agents?\\b)`, 'g'), `${ns}$1`);
  // 3. <name> spawn(s)
  out = out.replace(new RegExp(`(?<![\\w:-])(${alt})(?= spawns?\\b)`, 'g'), `${ns}$1`);
  // 5. subagent_type: <name>
  out = out.replace(
    new RegExp(`(subagent_type:\\s*)(?:rad-orchestration:)?(${alt})\\b`, 'g'),
    `$1${ns}$2`,
  );
  return out;
}

/**
 * @param {{ source: string, target: string, tokenMap: Record<string,string>, agentNames?: string[] }} opts
 */
export async function expandTokens(opts) {
  const { source, target, tokenMap, agentNames = [] } = opts;
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await expandTokens({ source: src, target: dst, tokenMap, agentNames });
      continue;
    }
    if (isText(src)) {
      const raw = fs.readFileSync(src, 'utf8');
      const substituted = substituteTokens(raw, tokenMap);
      const namespaced = applyNamespacing(substituted, agentNames);
      fs.writeFileSync(dst, namespaced);
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}
