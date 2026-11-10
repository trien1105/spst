@echo off
title MAY CHU BACKEND - DUA TOP VNR202 (PORT 4000)
color 0E

echo ======================================================================
echo           KHOI CHAY BACKEND MAY CHU DUA TOP VNR202 (PORT 4000)
echo ======================================================================
echo.

:: Kiem tra va don dep neu port 4000 dang bi chiem
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo [DANG KHOI DONG BACKEND...]
node server.js

pause

