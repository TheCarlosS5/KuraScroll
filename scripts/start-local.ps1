# KuraScroll Local Launcher Script for Windows
Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "       KuraScroll • Sister Platform to KuraStream       " -ForegroundColor Magenta
Write-Host "=========================================================" -ForegroundColor Cyan

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $CurrentDir
Set-Location $ProjectRoot

# Ensure data storage directories exist
$StorageDirs = @(
    "$ProjectRoot\data\storage\covers",
    "$ProjectRoot\data\storage\incoming",
    "$ProjectRoot\data\storage\backups",
    "$ProjectRoot\data\storage\series"
)
foreach ($dir in $StorageDirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

# Hardware Profile Detection (Intel Pentium T4500 / 3-4GB RAM Support)
$CpuCores = [System.Environment]::ProcessorCount
$TotalRamBytes = 0
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $TotalRamBytes = $osInfo.TotalVisibleMemorySize * 1024
} catch {}

$IsLowResource = ($CpuCores -le 2) -or ($TotalRamBytes -gt 0 -and $TotalRamBytes -le 4500000000)
$NodeMemoryFlag = "--max-old-space-size=2048"

if ($IsLowResource) {
    Write-Host "[Hardware] Detectado perfil modesto/legacy (Intel Pentium T4500 o <=4GB RAM)." -ForegroundColor Cyan
    Write-Host "[Hardware] Activando Low-Resource Mode (sharp.concurrency=1, RAM protegida)." -ForegroundColor DarkCyan
    $env:LOW_RESOURCE_MODE = "true"
    $NodeMemoryFlag = "--max-old-space-size=512"
}

Write-Host "[1/2] Iniciando KuraScroll Backend API en puerto 4000..." -ForegroundColor Yellow
$BackendProcess = Start-Process -FilePath "npx" -ArgumentList "tsx watch $NodeMemoryFlag src/backend/server.ts" -WorkingDirectory $ProjectRoot -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/2] Iniciando KuraScroll Frontend UI en puerto 5173..." -ForegroundColor Green
$FrontendProcess = Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$ProjectRoot\frontend" -PassThru

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "✔ KuraScroll corriendo con éxito!" -ForegroundColor Green
Write-Host "  - UI Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  - API Backend:  http://localhost:4000/health" -ForegroundColor Cyan
Write-Host "  - Almacenamiento: $ProjectRoot\data\storage" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Ctrl+C o cierra esta ventana para detener." -ForegroundColor DarkGray

Wait-Process -Id $BackendProcess.Id
