'use strict';

const fs = require('fs');
const path = require('path');

// ─── Helpers ────────────────────────────────────────────────────────────────

function outputAndExit(result, code) {
  console.log(JSON.stringify(result));
  process.exit(code);
}

function parseArgs(argv) {
  let projectsBasePath = null;
  let projectName = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--projects-base-path' && i + 1 < argv.length) {
      projectsBasePath = argv[++i];
    } else if (argv[i] === '--project-name' && i + 1 < argv.length) {
      projectName = argv[++i];
    }
  }
  return { projectsBasePath, projectName };
}

// ─── Planning doc detection ──────────────────────────────────────────────────

function scanPlanningDocs(projectDir) {
  let files;
  try {
    files = fs.readdirSync(projectDir);
  } catch {
    return null;
  }

  const mdFiles = files.filter(f => f.endsWith('.md'));

  const goalsFile = mdFiles.find(f => f === 'GOALS.md') || null;
  const brainstormingFile = mdFiles.find(f => f.toUpperCase().includes('BRAINSTORMING')) || null;
  const masterPlanFile = mdFiles.find(f => f.toUpperCase().includes('MASTER-PLAN')) || null;

  return {
    hasGoals: !!goalsFile,
    hasBrainstorming: !!brainstormingFile,
    hasMasterPlan: !!masterPlanFile,
    goalsPath: goalsFile ? path.join(projectDir, goalsFile) : null,
    brainstormingPath: brainstormingFile ? path.join(projectDir, brainstormingFile) : null,
  };
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = { parseArgs, scanPlanningDocs };

// ─── Main ───────────────────────────────────────────────────────────────────

if (require.main !== module) return;

const { projectsBasePath, projectName } = parseArgs(process.argv);

if (!projectsBasePath) {
  outputAndExit({
    error: 'missing_args',
    message: '--projects-base-path is required'
  }, 2);
}

if (!fs.existsSync(projectsBasePath)) {
  outputAndExit({
    error: 'path_not_found',
    message: 'Projects base path does not exist: ' + projectsBasePath
  }, 2);
}

// Single-project mode: look up one project by name
if (projectName) {
  const projectDir = path.join(projectsBasePath, projectName);
  const docs = scanPlanningDocs(projectDir);

  if (!docs) {
    outputAndExit({ projects: [] }, 0);
  }

  const isPlanningReady = (docs.hasGoals || docs.hasBrainstorming) && !docs.hasMasterPlan;

  outputAndExit({
    projects: [{
      name: projectName,
      isPlanningReady,
      hasGoals: docs.hasGoals,
      hasBrainstorming: docs.hasBrainstorming,
      goalsPath: docs.goalsPath,
      brainstormingPath: docs.brainstormingPath,
    }]
  }, 0);
}

// Scan mode: find all planning-ready projects
let dirs;
try {
  dirs = fs.readdirSync(projectsBasePath, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'))
    .sort((a, b) => a.name.localeCompare(b.name));
} catch (err) {
  outputAndExit({
    error: 'read_failed',
    message: 'Failed to read projects directory: ' + err.message
  }, 2);
}

const projects = [];

for (const dir of dirs) {
  const projectDir = path.join(projectsBasePath, dir.name);
  const docs = scanPlanningDocs(projectDir);

  if (!docs) continue;
  if (!(docs.hasGoals || docs.hasBrainstorming)) continue;
  if (docs.hasMasterPlan) continue;

  projects.push({
    name: dir.name,
    isPlanningReady: true,
    hasGoals: docs.hasGoals,
    hasBrainstorming: docs.hasBrainstorming,
    goalsPath: docs.goalsPath,
    brainstormingPath: docs.brainstormingPath,
  });
}

outputAndExit({ projects }, 0);
