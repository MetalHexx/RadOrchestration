#!/usr/bin/env bash
set -eu
HOME_DIR="${RADORCH_HOME:-$HOME/.radorch}"
mkdir -p "$HOME_DIR/projects" "$HOME_DIR/logs" "$HOME_DIR/runtime"
if [ ! -f "$HOME_DIR/registry.yml" ]; then
  printf "repos: []\nworkspaces: []\n" > "$HOME_DIR/registry.yml"
fi
if [ ! -f "$HOME_DIR/config.yml" ]; then
  printf "default_active_harness: claude\n" > "$HOME_DIR/config.yml"
fi
if [ ! -f "$HOME_DIR/install.json" ]; then
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  cat > "$HOME_DIR/install.json" <<EOF
{
  "package_version": "1.0.0-alpha.8",
  "installed_at": "$NOW",
  "last_writer_version": "1.0.0-alpha.8",
  "state_schema_version": "v5"
}
EOF
fi
# Provision orchestration.yml so the dashboard UI's projects API can boot
# without ENOENT. ~/.radorch is the canonical workspace in plugin mode:
# orch_root="." (workspace IS orch root), projects under "projects".
ORCH_YML="$HOME_DIR/skills/rad-orchestration/config/orchestration.yml"
if [ ! -f "$ORCH_YML" ]; then
  mkdir -p "$(dirname "$ORCH_YML")"
  cat > "$ORCH_YML" <<'EOF'
version: "1.0"

package_version: 1.0.0-alpha.8

system:
  orch_root: "."

projects:
  base_path: "projects"
  naming: "SCREAMING_CASE"

limits:
  max_phases: 10
  max_tasks_per_phase: 8
  max_retries_per_task: 5
  max_consecutive_review_rejections: 3

human_gates:
  after_planning: true
  execution_mode: "ask"
  after_final_review: true

source_control:
  auto_commit: "ask"
  auto_pr: "ask"
  provider: "github"
EOF
fi
# Provision .env.local for the plugin UI dashboard. Belt-and-suspenders
# alongside cli/src/commands/ui/start.ts's env-var injection — useful for
# users who want to inspect what the UI sees from outside Claude Code.
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -d "${CLAUDE_PLUGIN_ROOT}/ui" ]; then
  ENV_LOCAL="${CLAUDE_PLUGIN_ROOT}/ui/.env.local"
  if [ ! -f "$ENV_LOCAL" ]; then
    printf 'WORKSPACE_ROOT=%s\nORCH_ROOT=.\n' "$HOME_DIR" > "$ENV_LOCAL"
  fi
fi
exit 0
