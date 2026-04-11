'use strict';

const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function parseArgs(argv) {
  let orchRoot = null;
  let repoRoot = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--orch-root' && i + 1 < argv.length) {
      orchRoot = argv[++i];
    } else if (argv[i] === '--repo-root' && i + 1 < argv.length) {
      repoRoot = argv[++i];
    }
  }
  return { orchRoot, repoRoot };
}

// ─── Template YAML parsing ───────────────────────────────────────────────────

/**
 * Extract `template.id` and `template.description` from a template YAML file.
 * Handles both quoted and unquoted scalar values.
 */
function parseTemplateYaml(content) {
  const idMatch = content.match(/^\s*id:\s*["']?([^"'\n#]+?)["']?\s*(?:#.*)?$/m);
  const descMatch = content.match(/^\s*description:\s*["']([^"'\n]+)["']\s*(?:#.*)?$/m)
    || content.match(/^\s*description:\s*([^"'\n#][^\n]*?)\s*(?:#.*)?$/m);

  return {
    id: idMatch ? idMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : null,
  };
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseArgs, parseTemplateYaml };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { orchRoot, repoRoot } = parseArgs(process.argv);

if (!orchRoot || !repoRoot) {
  outputAndExit({
    error: 'missing_args',
    message: '--orch-root and --repo-root are required'
  }, 2);
}

const templatesDir = path.resolve(repoRoot, orchRoot, 'skills', 'orchestration', 'templates');

if (!fs.existsSync(templatesDir)) {
  outputAndExit({
    error: 'templates_not_found',
    message: 'Templates directory not found: ' + templatesDir
  }, 2);
}

let files;
try {
  files = fs.readdirSync(templatesDir)
    .filter(f => f.endsWith('.yml') && f !== '.gitkeep')
    .sort();
} catch (err) {
  outputAndExit({
    error: 'read_failed',
    message: 'Failed to read templates directory: ' + err.message
  }, 2);
}

const templates = [];

for (const file of files) {
  const filePath = path.join(templatesDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { id, description } = parseTemplateYaml(content);
    if (id) {
      templates.push({ id, description: description || '', path: filePath });
    }
  } catch {
    // Skip unreadable or unparseable files
  }
}

outputAndExit({ templates }, 0);
