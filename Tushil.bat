@echo off
title TUSHIL Portal - Dev Server
cd /d "%~dp0"
echo Starting TUSHIL Portal dev server...
echo.
npx vite --port=3000 --host=0.0.0.0
echo.
echo Server stopped.
pause
