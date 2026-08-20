# Build locally (Windows) and push to the testing/production VPS.
# Usage:
#   .\scripts\push-build-to-vps.ps1
#   .\scripts\push-build-to-vps.ps1 -SkipBuild
#   .\scripts\push-build-to-vps.ps1 -VpsHost 162.35.99.177 -VpsUser root -VpsPath /home/insight-books-v2.5

param(
  [switch]$SkipBuild,
  [string]$VpsHost = $env:VPS_HOST,
  [string]$VpsUser = $(if ($env:VPS_USER) { $env:VPS_USER } else { "root" }),
  [string]$VpsPath = $(if ($env:VPS_PATH) { $env:VPS_PATH } else { "/home/insight-books-v2.5" }),
  [string]$Pm2Name = $(if ($env:PM2_NAME) { $env:PM2_NAME } else { "insightdev" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not $VpsHost) {
  Write-Error "Set VPS_HOST or pass -VpsHost (e.g. 162.35.99.177)"
}

if (-not $SkipBuild) {
  Write-Host "==> Building locally (npm run build:clean)..."
  npm run build:clean
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not (Test-Path ".next\BUILD_ID")) {
  Write-Error ".next\BUILD_ID missing — build failed or was not run."
}

Write-Host "==> Creating deploy bundle..."
$Bundle = Join-Path $env:TEMP "insightbooks-deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"

# Exclude heavy/dev Next output; include everything the server needs to start.
$tarArgs = @(
  "-czf", $Bundle,
  "--exclude=.next/cache",
  "--exclude=.next/dev",
  "--exclude=.next/trace",
  "--exclude=.next/trace-build",
  "--exclude=.next/diagnostics",
  "--exclude=node_modules",
  "--exclude=.git",
  "--exclude=.env",
  "--exclude=public/uploads",
  ".next",
  "package.json",
  "package-lock.json",
  "prisma",
  "public",
  "next.config.mjs",
  "lib",
  "app",
  "components",
  "middleware.js",
  "middleware.ts",
  "scripts/vps-reload.sh",
  "scripts/fix-next-deploy-paths.cjs"
)

& tar @tarArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Remote = "${VpsUser}@${VpsHost}:${VpsPath}/"
Write-Host "==> Uploading to $Remote"
scp $Bundle "${VpsUser}@${VpsHost}:/tmp/insightbooks-deploy.tar.gz"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "==> Extracting and reloading on VPS"
$sshCmd = @"
set -e
cd '$VpsPath'
pm2 stop '$Pm2Name' || true
tar -xzf /tmp/insightbooks-deploy.tar.gz
chmod +x scripts/vps-reload.sh
PM2_NAME='$Pm2Name' bash scripts/vps-reload.sh
rm -f /tmp/insightbooks-deploy.tar.gz
"@

ssh "${VpsUser}@${VpsHost}" $sshCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Remove-Item $Bundle -Force -ErrorAction SilentlyContinue
Write-Host "==> Deploy complete: http://${VpsHost}:3000"
