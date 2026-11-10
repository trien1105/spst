@echo off
title DAY CODE LEN GITHUB - trien1105/spst
color 0B
echo ========================================================
echo    DANG CHUAN BI DAY CODE LEN: https://github.com/trien1105/spst
echo ========================================================
echo.
git remote set-url origin https://github.com/trien1105/spst.git
git branch -M main

echo [1] Dang thuc hien day code qua trinh duyet...
echo (Neu trinh duyet mo ra, ban chi can bam xac nhan dang nhap tai khoan trien1105)
echo.

git push -u origin main
if %errorlevel% equ 0 goto :success

echo.
echo ========================================================
echo [CANH BAO] Push truc tiep chua thanh cong hoac can Token!
echo Neu ban co GitHub Personal Access Token (PAT):
echo ========================================================
set /p TOKEN="Nhap Personal Access Token cua ban (hoac Enter de bo qua): "
if not "%TOKEN%"=="" (
    echo Dang thu lai voi Token...
    git push -u https://%TOKEN%@github.com/trien1105/spst.git main
    if %errorlevel% equ 0 goto :success
)

echo.
echo [LOI] Khong the push. Vui long kiem tra quyen truy cap repository.
pause
exit /b 1

:success
echo.
echo ========================================================
echo  THANH CONG 100%!
echo  Ma nguon da duoc day len: https://github.com/trien1105/spst
echo ========================================================
echo.
pause
