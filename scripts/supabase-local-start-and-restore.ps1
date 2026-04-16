<#
.SYNOPSIS
  Start Supabase local Postgres and restore a pg_dump custom-format backup.

.DESCRIPTION
  Requires Docker Desktop running and Supabase CLI.
  Default backup: insightbooks_backup_April_16.dump in the project root (next to prisma/).
  DB port must match supabase/config.toml [db].port and .env DATABASE_URL.
  Uses --ignore-health-check so Studio flakiness on Windows does not block Postgres.

.PARAMETER DumpPath
  Full path to .dump file (pg_dump -Fc format).

.PARAMETER ClearData
  If set, runs supabase stop --no-backup first (wipes local Supabase volumes for this project).

.EXAMPLE
  .\scripts\supabase-local-start-and-restore.ps1
  .\scripts\supabase-local-start-and-restore.ps1 -ClearData
  .\scripts\supabase-local-start-and-restore.ps1 -DumpPath "D:\backups\my.dump"
#>
param(
  [string] $DumpPath = "",
  [switch] $ClearData
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

if (-not $DumpPath) {
  $DumpPath = Join-Path $ProjectRoot "insightbooks_backup_April_16.dump"
}

function Test-DockerEngine {
  try {
    & docker info 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

if (-not (Test-DockerEngine)) {
  Write-Host "Docker engine is not reachable. Start Docker Desktop, wait until it is running, then re-run this script." -ForegroundColor Yellow
  Write-Host "Install: winget install -e --id Docker.DockerDesktop" -ForegroundColor Gray
  exit 1
}

if (-not (Test-Path (Join-Path $ProjectRoot "supabase\config.toml"))) {
  Write-Host "Missing supabase\config.toml. From project root run: supabase init" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path $DumpPath)) {
  Write-Host "Backup file not found: $DumpPath" -ForegroundColor Red
  exit 1
}

Set-Location $ProjectRoot
Write-Host "Project: $ProjectRoot" -ForegroundColor Cyan
Write-Host "Dump:    $DumpPath" -ForegroundColor Cyan
if ($ClearData) {
  Write-Host "Clearing local Supabase data (docker volumes)..." -ForegroundColor Yellow
  & supabase stop --no-backup
}
Write-Host "Starting Supabase (first run may pull images; DB port from supabase/config.toml)..." -ForegroundColor Cyan
& supabase start --ignore-health-check
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$dbContainer = (& docker ps --format "{{.Names}}" | Where-Object { $_ -like "supabase_db_*" } | Select-Object -First 1)
if (-not $dbContainer) {
  Write-Host "Could not find supabase_db_* container. Run: docker ps" -ForegroundColor Red
  exit 1
}

Write-Host "Using container: $dbContainer" -ForegroundColor Cyan
$remoteDump = "/tmp/insightbooks_restore.dump"
& docker cp $DumpPath "${dbContainer}:${remoteDump}"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host "Restoring into database postgres..." -ForegroundColor Cyan
# --no-owner --no-acl: avoid role/ACL mismatches on local postgres user
& docker exec $dbContainer pg_restore -U postgres -d postgres --verbose --no-owner --no-acl $remoteDump
$restoreCode = $LASTEXITCODE
& docker exec $dbContainer rm -f $remoteDump 2>$null

# pg_restore often returns 1 for non-fatal warnings; 2+ is more serious
if ($restoreCode -ge 2) {
  Write-Host "pg_restore exited with code $restoreCode." -ForegroundColor Yellow
  exit $restoreCode
}

Write-Host "Done. Run: supabase status -o env  (Studio URL and DB_URL). Match .env DATABASE_URL to DB_URL." -ForegroundColor Green
Write-Host "If Prisma schema drifted, run: npx prisma migrate deploy" -ForegroundColor Gray
