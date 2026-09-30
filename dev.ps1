#Requires -Version 5.1
<#
.SYNOPSIS
    Starts the 3D-Annotator backend and frontend dev servers, each in its
    own terminal window.

.PARAMETER Install
    Runs `pnpm install` in frontend/ before starting it (use this after
    pulling changes that touched frontend/package.json).

.EXAMPLE
    .\dev.ps1
    .\dev.ps1 -Install
#>
param(
	[switch]$Install
)

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$venvActivate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
	Write-Error "Backend virtual environment not found at 'backend\.venv'. Follow the 'Backend setup' steps in README.md first."
}
if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
	Write-Error "Frontend dependencies not found at 'frontend\node_modules'. Run '.\dev.ps1 -Install' or follow the 'Frontend setup' steps in README.md first."
}

Write-Host "Starting backend (http://127.0.0.1:8000) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
	"-NoExit", "-Command",
	"Set-Location '$backendDir'; & '$venvActivate'; `$env:DJANGO_DEBUG='true'; python manage.py runserver"
)

Write-Host "Starting frontend (http://localhost:3000) ..." -ForegroundColor Cyan
$frontendCommand = if ($Install) { "pnpm install; pnpm start" } else { "pnpm start" }
Start-Process powershell -ArgumentList @(
	"-NoExit", "-Command",
	"Set-Location '$frontendDir'; $frontendCommand"
)

Write-Host ""
Write-Host "Two terminal windows were opened - backend and frontend." -ForegroundColor Green
Write-Host "Close either window (or Ctrl+C inside it) to stop that server."
