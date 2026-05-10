$ErrorActionPreference = 'Stop'
$homeDir = if ($env:RADORCH_HOME) { $env:RADORCH_HOME } else { Join-Path $HOME '.radorch' }
foreach ($sub in 'projects','logs','runtime') {
  $p = Join-Path $homeDir $sub
  if (-not (Test-Path $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null }
}
$reg = Join-Path $homeDir 'registry.yml'
if (-not (Test-Path $reg)) { Set-Content -Path $reg -Value "repos: []`nworkspaces: []`n" -NoNewline }
$cfg = Join-Path $homeDir 'config.yml'
if (-not (Test-Path $cfg)) { Set-Content -Path $cfg -Value "default_active_harness: claude`n" -NoNewline }
$ij = Join-Path $homeDir 'install.json'
if (-not (Test-Path $ij)) {
  $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
  $obj = @{
    package_version = '1.0.0-alpha.8'
    installed_at = $now
    last_writer_version = '1.0.0-alpha.8'
    state_schema_version = 'v5'
  } | ConvertTo-Json
  Set-Content -Path $ij -Value $obj -NoNewline
}
# Provision orchestration.yml so the dashboard UI's projects API can boot
# without ENOENT. ~/.radorch is the canonical workspace in plugin mode:
# orch_root="." (workspace IS orch root), projects under "projects".
$orchYml = Join-Path $homeDir 'skills\rad-orchestration\config\orchestration.yml'
if (-not (Test-Path $orchYml)) {
  $orchYmlDir = Split-Path -Parent $orchYml
  if (-not (Test-Path $orchYmlDir)) { New-Item -ItemType Directory -Path $orchYmlDir -Force | Out-Null }
  $yml = "version: `"1.0`"`n`npackage_version: 1.0.0-alpha.8`n`nsystem:`n  orch_root: `".`"`n`nprojects:`n  base_path: `"projects`"`n  naming: `"SCREAMING_CASE`"`n`nlimits:`n  max_phases: 10`n  max_tasks_per_phase: 8`n  max_retries_per_task: 5`n  max_consecutive_review_rejections: 3`n`nhuman_gates:`n  after_planning: true`n  execution_mode: `"ask`"`n  after_final_review: true`n`nsource_control:`n  auto_commit: `"ask`"`n  auto_pr: `"ask`"`n  provider: `"github`"`n"
  Set-Content -Path $orchYml -Value $yml -NoNewline
}
# Provision .env.local for the plugin UI dashboard. Belt-and-suspenders
# alongside cli/src/commands/ui/start.ts's env-var injection — useful for
# users who want to inspect what the UI sees from outside Claude Code.
if ($env:CLAUDE_PLUGIN_ROOT -and (Test-Path (Join-Path $env:CLAUDE_PLUGIN_ROOT 'ui'))) {
  $envLocal = Join-Path $env:CLAUDE_PLUGIN_ROOT 'ui\.env.local'
  if (-not (Test-Path $envLocal)) {
    Set-Content -Path $envLocal -Value "WORKSPACE_ROOT=$homeDir`nORCH_ROOT=.`n" -NoNewline
  }
}
exit 0
