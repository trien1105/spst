@echo off
title DAY CODE LEN GITHUB
color 0B
echo ========================================================
echo    KET NOI VA DAY MA NGUON LEN GITHUB REPOSITORY
echo ========================================================
echo.
echo Hay dam bao ban da tao mot repository moi tren https://github.com/new
echo (Vi du: truytimdoclap)
echo.
set /p REPO_URL="Nhap dia chi URL Repository (VD: https://github.com/username/truytimdoclap.git): "
if "%REPO_URL%"=="" (
    echo [LOI] Ban chua nhap URL repository!
    pause
    exit /b 1
)

echo.
echo [1/3] Kiem tra va cap nhat Remote Origin...
git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

echo [2/3] Dat nhanh mac dinh la main...
git branch -M main

echo [3/3] Dang day ma nguon len GitHub...
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  THANH CONG! Ma nguon da duoc day len GitHub!
    echo ========================================================
) else (
    echo.
    echo [LUU Y] Neu gap loi xac thuc hoac quyen truy cap, hay dam bao ban da dang nhap GitHub tren may.
)
pause
