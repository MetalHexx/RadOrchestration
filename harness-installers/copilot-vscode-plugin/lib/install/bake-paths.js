import fs from 'node:fs';
import path from 'node:path';

const TOKEN = '${COPILOT_VSCODE_PLUGIN_ROOT}';

function walkMarkdown(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
}

function atomicWrite(file, content) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Bake the per-harness plugin-root token into the absolute install path
 * across every Markdown file under `<pluginRoot>/skills/`.
 *
 * VS Code injects `CLAUDE_PLUGIN_ROOT` only into hook processes, not into the
 * agent's chat-shell where bash blocks from SKILL.md actually execute. The
 * Claude and Copilot CLI siblings work because their runtimes populate the
 * env var in the chat-shell; VS Code's doesn't. Substituting the token on
 * disk after install closes the gap. Scope is intentionally `skills/` only —
 * `hooks/bootstrap.mjs`, `hooks/drift-check.mjs`, and `hooks/AGENTS.md`
 * reference the same token in their own env-var logic and prose and must not
 * be baked.
 */
export function bakeAbsolutePaths(pluginRoot) {
  const skillsDir = path.join(pluginRoot, 'skills');
  const files = [];
  walkMarkdown(skillsDir, files);
  // Forward-slash form survives both bash and PowerShell double-quoted arguments
  // to native commands like `node`.
  const replacement = pluginRoot.replaceAll('\\', '/');
  let baked = 0;
  for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    if (!before.includes(TOKEN)) continue;
    const after = before.split(TOKEN).join(replacement);
    atomicWrite(file, after);
    baked++;
  }
  return { baked, scanned: files.length };
}
