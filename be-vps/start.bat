@echo off
chcp 65001 >nul
title CON DUONG DOC LAP - VPS BACKEND SERVER (180.93.126.40:4000)

REM Mở cổng 4000 trên Windows Firewall của VPS Windows (nếu chạy quyền Admin)
netsh advfirewall firewall add rule name="ConDuongDocLap_BE_4000" dir=in action=allow protocol=TCP localport=4000 >nul 2>&1

echo ================================================================
echo   KHOI DONG BACKEND CON DUONG DOC LAP TREN VPS 180.93.126.40
echo ================================================================
node server.js
pause

