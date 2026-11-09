@echo off
setlocal
title CON DUONG DOC LAP (1930 - 1945) - VNR202
color 0A

echo ======================================================================
echo          CON DUONG DOC LAP (1930 - 1945) - GAME VNR202
echo            HOC PHAN: LICH SU DANG CONG SAN VIET NAM
echo ======================================================================
echo.

:: 1. Kiem tra Node.js
where node >nul 2>nul
if %errorlevel% neq 0 goto :no_node

:: 2. Kiem tra thu vien node_modules
if not exist "node_modules\" goto :install_deps
goto :start_game

:install_deps
echo [THONG BAO] Dang cai dat thu vien, vui long cho trong giay lat...
where npm.cmd >nul 2>nul
if %errorlevel% equ 0 (
    call npm.cmd install
) else (
    call npm install
)
if %errorlevel% neq 0 goto :install_fail

:start_game
echo.
echo [KIEM TRA VA DỌN DEP PORT 5173...]
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>nul
)

echo [DANG KHOI CHAY SERVER GAME...]
echo Trinh duyet se tu dong mo tai: http://localhost:5173/
echo (Nhan Ctrl + C de dung server khi muon thoat)
echo ======================================================================
echo.

where npm.cmd >nul 2>nul
if %errorlevel% equ 0 (
    call npm.cmd run dev -- --open
) else (
    call npm run dev -- --open
)
goto :end

:no_node
color 0C
echo [LOI] May tinh cua ban chua cai dat Node.js!
echo Vui long cai dat Node.js tu: https://nodejs.org/
echo Sau khi cai dat xong, hay chay lai file run.bat nay.
echo.
pause
exit /b 1

:install_fail
color 0C
echo.
echo [LOI] Khong the cai dat thu vien!
echo Vui long kiem tra ket noi mang va thu lai.
echo.
pause
exit /b 1

:end
endlocal
