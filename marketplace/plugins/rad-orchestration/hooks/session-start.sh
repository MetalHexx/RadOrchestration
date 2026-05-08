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
  "package_version": "1.1.0",
  "installed_at": "$NOW",
  "last_writer_version": "1.1.0",
  "state_schema_version": "v5"
}
EOF
fi
exit 0
