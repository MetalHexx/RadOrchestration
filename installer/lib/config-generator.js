// installer/lib/config-generator.js — Config generator module

import fs from 'node:fs';
import path from 'node:path';

/** @import { InstallerConfig } from './types.js' */

/**
 * Generates orchestration.yml content with inline comments.
 * @param {InstallerConfig} config - Resolved configuration from wizard
 * @returns {string} - Complete YAML file content
 */
export function generateConfig(config) {
  return `# orchestration.yml
# Orchestration System Configuration
# -----------------------------------

version: "1.0"

# ─── System ────────────────────────────────────────────────────────
system:
  orch_root: "${config.orchRoot}"                   # Orchestration root folder (relative name or absolute path)

# ─── Project Storage ───────────────────────────────────────────────
projects:
  # base_path accepts both relative paths (resolved from workspace root)
  # and absolute paths (e.g., /shared/projects for git worktree setups).
  base_path: "${config.projectsBasePath}"          # Where project folders are created
  naming: "${config.projectsNaming}"               # SCREAMING_CASE | lowercase | numbered

# ─── Pipeline Limits (Scope Guards) ───────────────────────────────
limits:
  max_phases: ${config.maxPhases}                         # Maximum phases per project
  max_tasks_per_phase: ${config.maxTasksPerPhase}                 # Maximum tasks per phase
  max_retries_per_task: ${config.maxRetriesPerTask}                # Auto-retries before escalation
  max_consecutive_review_rejections: ${config.maxConsecutiveReviewRejections}  # Reviewer rejects before human escalation

# ─── Human Gate Defaults ───────────────────────────────────────────
human_gates:
  after_planning: true                   # Always gate after master plan (hard default)
  execution_mode: "${config.executionMode}"                  # ask | phase | task | autonomous
  after_final_review: true               # Always gate after final review (hard default)

# ─── RAG (Optional) ───────────────────────────────────────────────
# Retrieval-Augmented Generation for project knowledge and context.
# Requires: docker compose up -d (for Postgres+pgvector)
# Requires: AWS credentials with Bedrock access
rag:
  enabled: false                         # Set to true after running docker compose up -d
  db_host: localhost
  db_port: 5432
  db_name: radorch_rag
  db_user: radorch
  db_password: radorch_dev
  bedrock_region: us-east-1
  bedrock_model: "cohere.embed-v4:0"
  embedding_dimensions: 1024

# ─── Notes ─────────────────────────────────────────────────────────
# Model selection is configured per-agent in .agent.md frontmatter.
# See ${config.orchRoot}/agents/*.agent.md → \`model\` field.
`;
}

/**
 * Writes orchestration.yml to the correct path, creating intermediate directories.
 * @param {string} workspaceDir - Absolute path to target workspace
 * @param {string} orchRoot - Orchestration root folder name or absolute path
 * @param {string} yamlContent - Generated YAML content
 * @returns {void}
 */
export function writeConfig(workspaceDir, orchRoot, yamlContent) {
  const resolvedOrchRoot = path.isAbsolute(orchRoot)
    ? orchRoot
    : path.join(workspaceDir, orchRoot);

  const targetDir = path.join(resolvedOrchRoot, 'skills', 'orchestration', 'config');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'orchestration.yml'), yamlContent);
}
