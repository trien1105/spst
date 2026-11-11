@echo off
title MAY CHU BACKEND + NGROK - CON DUONG DOC LAP
color 0B

echo ======================================================================
echo    KHOI CHAY BACKEND CUC BO + NGROK CHO VERCEL.APP
echo    LINK NGROK: https://unattractable-cognoscitively-catheryn.ngrok-free.dev
echo ======================================================================
echo.

:: Don dep port 4000 neu dang bi chiem
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo [DANG KHOI DONG BACKEND PORT 4000 ^& KET NOI NGROK...]
node server.js

pause
