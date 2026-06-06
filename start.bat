@echo off
echo ==========================================================
echo   AgentAudit - One-Click Launch
echo ==========================================================
echo.
echo Starting 3 services:
echo   :3005  Module5 API   (SQLite database)
echo   :3000  Gateway API
echo   :5173  Frontend
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo All services stopped.
pause >nul
