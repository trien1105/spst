@echo off
title DEPLOY LEN VERCEL (conduongdoclap.vercel.app)
color 0A
echo ========================================================
echo     TRIEN KHAI GAME LEN VERCEL
echo     Ten mien muc tieu: conduongdoclap.vercel.app
echo ========================================================
echo.
echo He thong se khoi dong Vercel CLI de lien ket va deploy.
echo Neu la lan dau, trinh duyet se mo de ban dang nhap Vercel.
echo.
echo Khi duoc hoi "What's your project's name?", hay nhap: conduongdoclap
echo.
call npx vercel
echo.
echo [BUOC TIEP THEO] Deploy len Production (conduongdoclap.vercel.app)...
call npx vercel --prod
echo.
echo Hoan tat! Hay kiem tra trang web tren trinh duyet.
pause

