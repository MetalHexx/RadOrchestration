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
    package_version = '1.1.0'
    installed_at = $now
    last_writer_version = '1.1.0'
    state_schema_version = 'v5'
  } | ConvertTo-Json
  Set-Content -Path $ij -Value $obj -NoNewline
}
exit 0
