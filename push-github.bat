@echo off
title DAY CODE LEN GITHUB - trien1105/spst
color 0B
echo ========================================================
echo    DANG DAY CODE LEN GITHUB: trien1105/spst
echo ========================================================
echo.
git remote set-url origin https://github.com/trien1105/spst.git
git branch -M main

echo [DANG PUSH LEN GITHUB...]
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  THANH CONG! Ma nguon da duoc day len GitHub!
    echo  https://github.com/trien1105/spst
    echo ========================================================
) else (
    echo.
    echo [THONG BAO] Neu trinh duyet mo ra hoi quyen dang nhap,
    echo hay dang nhap dung tai khoan GitHub: trien1105
)
pause
