@echo off
title MAY CHU BACKEND CUC BO - CON DUONG DOC LAP (PORT 4000)
color 0E

echo ======================================================================
echo       KHOI CHAY ENGINE JS ^& BACKEND CON DUONG DOC LAP (PORT 4000)
echo ======================================================================
echo.

:: Kiem tra va don dep neu port 4000 dang bi chiem
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo [DANG KHOI DONG MAY CHU CUC BO CHIU TAI 60 NGUOI...]
node server.js

pause
