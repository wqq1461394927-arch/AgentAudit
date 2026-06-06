$root = "e:\XZ\tuanduei\AgentAudit"
Set-Location $root

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  AgentAudit - One-Click Launch" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# ── 清理旧进程 ──────────────────────────────────
Write-Host "[0/3] Cleaning old Node processes..." -ForegroundColor Gray
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "       Done" -ForegroundColor Green
Write-Host ""

# ── 三项服务并行启动 ────────────────────────────
Write-Host "[1/3] Module5 API  :3005 (SQLite)" -ForegroundColor Yellow
Write-Host "[2/3] Gateway API  :3000" -ForegroundColor Yellow  
Write-Host "[3/3] Frontend     :5173" -ForegroundColor Yellow
Write-Host ""

$p1 = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    '/c', "title AgentAudit-M5 && cd /d `"$root\module5-settlement\backend`" && node src\index.js && pause"
) -PassThru

$p2 = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    '/c', "title AgentAudit-GW && cd /d `"$root\server`" && npx tsx src\index.ts && pause"
) -PassThru

$p3 = Start-Process -FilePath "cmd.exe" -ArgumentList @(
    '/c', "title AgentAudit-FE && cd /d `"$root\frontend`" && npm run dev && pause"
) -PassThru

# ── 等待并验证 ──────────────────────────────────
Write-Host "Waiting 8s for all services..." -ForegroundColor Gray
Start-Sleep -Seconds 8

Write-Host ""
Write-Host "Verifying ports..." -ForegroundColor Yellow

$ports = @(
    @{Port=3005; Name="Module5 API "},
    @{Port=3000; Name="Gateway API "},
    @{Port=5173; Name="Frontend    "}
)
$allOk = $true
foreach ($p in $ports) {
    try {
        $conn = New-Object System.Net.Sockets.TcpClient
        $conn.Connect("127.0.0.1", $p.Port)
        Write-Host "       $($p.Name) :$($p.Port) OK" -ForegroundColor Green
        $conn.Close()
    } catch {
        Write-Host "       $($p.Name) :$($p.Port) NOT READY (wait a few secs)" -ForegroundColor Red
        $allOk = $false
    }
}

Write-Host ""
if ($allOk) {
    Write-Host "All services ready!" -ForegroundColor Green
} else {
    Write-Host "Some ports not ready. Wait 5 extra seconds..." -ForegroundColor DarkYellow
    Start-Sleep -Seconds 5
}

Write-Host "Opening browser..." -ForegroundColor Green
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Frontend       http://localhost:5173" -ForegroundColor White
Write-Host "  Gateway API    http://localhost:3000/api/health" -ForegroundColor White
Write-Host "  Module5 API    http://localhost:3005/health" -ForegroundColor White
Write-Host "  Reset DB       POST http://localhost:3005/api/reset" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the 3 cmd windows to stop all services." -ForegroundColor Gray
