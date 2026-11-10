@echo off
title MAY CHU BACKEND ONLINE (HTTPS TUNNEL) - DUA TOP VNR202
color 0B

echo ======================================================================
echo    KHOI CHAY BACKEND CUC BO + DUONG HAM HTTPS CHO VERCEL.APP
echo ======================================================================
echo.

:: 1. Don dep port 4000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":4000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: 2. Chay server ngam
echo [1/2] Dang khoi dong Backend Node.js tai port 4000...
start "VNR202-Backend-Port4000" cmd /c "node server.js"

:: 3. Khoi tao HTTPS Tunnel cho Vercel
echo [2/2] Dang tao duong ham HTTPS cong khai qua localtunnel...
echo (Duong link https://... se hien ra ben duoi, hay copy link nay)
echo ======================================================================
echo.

call npx localtunnel --port 4000

pause
