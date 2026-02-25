$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $PSScriptRoot ".state"
$pidFile = Join-Path $stateDir "mysql-proxy.pid"
$proxyScript = Join-Path $PSScriptRoot "mysql-proxy.js"
$proxyOutLog = Join-Path $stateDir "mysql-proxy.out.log"
$proxyErrLog = Join-Path $stateDir "mysql-proxy.err.log"

if (!(Test-Path $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir | Out-Null
}

if (!(Test-Path $proxyScript)) {
    throw "No se encontró el archivo de proxy: $proxyScript"
}

$startProxy = $true
if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid) {
        $existingProcess = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($existingProcess) {
            Write-Host "Proxy MySQL ya está corriendo (PID $existingPid)."
            $startProxy = $false
        }
    }
}

if ($startProxy) {
    $process = Start-Process `
        -FilePath "node" `
        -ArgumentList "`"$proxyScript`"" `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $proxyOutLog `
        -RedirectStandardError $proxyErrLog `
        -PassThru

    Set-Content -Path $pidFile -Value $process.Id
    Start-Sleep -Seconds 1
    Write-Host "Proxy MySQL iniciado (PID $($process.Id))."
}

Push-Location $projectRoot
try {
    docker compose up -d --build
    docker compose ps
} finally {
    Pop-Location
}

Write-Host "Listo: entorno local dockerizado levantado."
