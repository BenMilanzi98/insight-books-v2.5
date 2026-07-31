<#
.SYNOPSIS
  Register or remove a Windows scheduled task that starts local Scoop PostgreSQL at logon.

.DESCRIPTION
  Matches the DATABASE_URL in .env:
    postgresql://insightbooksmw:Password2026@localhost:5432/insightbooksmw

.PARAMETER Unregister
  Remove the scheduled task instead of creating it.

.EXAMPLE
  .\scripts\register-postgres-startup-task.ps1
  .\scripts\register-postgres-startup-task.ps1 -Unregister
#>
param(
  [switch] $Unregister
)

$ErrorActionPreference = "Stop"

$TaskName = "InsightBooks PostgreSQL"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$StartScript = Join-Path $PSScriptRoot "start-postgres.bat"

if ($Unregister) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task: $TaskName"
  exit 0
}

if (-not (Test-Path $StartScript)) {
  throw "Start script not found: $StartScript"
}

$pgData = Join-Path $env:USERPROFILE "scoop\persist\postgresql\data"
if (-not (Test-Path $pgData)) {
  throw "PostgreSQL data directory not found: $pgData"
}

$action = New-ScheduledTaskAction -Execute $StartScript -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Start local Scoop PostgreSQL for InsightBooks (localhost:5432)" `
  -Force | Out-Null

Write-Host "Registered scheduled task: $TaskName"
Write-Host "Runs at logon for user: $env:USERNAME"
Write-Host "Script: $StartScript"
Write-Host ""
Write-Host "Manual start:  .\scripts\start-postgres.bat"
Write-Host "Manual stop:   .\scripts\stop-postgres.bat"
Write-Host "Remove task:   .\scripts\register-postgres-startup-task.ps1 -Unregister"
