$ErrorActionPreference = "Continue"

$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $PSScriptRoot ".state"
$pidFile = Join-Path $stateDir "mysql-proxy.pid"

Push-Location $projectRoot
try {
    docker compose down
} finally {
    Pop-Location
}

if (Test-Path $pidFile) {
    $proxyPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($proxyPid) {
        $process = Get-Process -Id $proxyPid -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $proxyPid -Force
            Write-Host "Proxy MySQL detenido (PID $proxyPid)."
        }
    }

    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

$listenerLines = netstat -ano | Select-String ":13306"
foreach ($line in $listenerLines) {
    $parts = ($line -replace "\s+", " ").Trim().Split(" ")
    if ($parts.Length -ge 5 -and $parts[3] -eq "LISTENING") {
        $listenerPid = $parts[4]
        if ($listenerPid -match "^\d+$") {
            $listenerProcess = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
            if ($listenerProcess) {
                Stop-Process -Id $listenerPid -Force
                Write-Host "Proxy/listener en 13306 detenido (PID $listenerPid)."
            }
        }
    }
}

Write-Host "Listo: entorno local dockerizado detenido."
