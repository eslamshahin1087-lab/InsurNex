@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-analytics2-fix-backup"
set "T=src\features\analytics\analytics.service.ts"
if not exist "%B%\%T%" (echo [ERROR] Fix backup not found.& exit /b 20)
copy /y "%B%\%T%" "%T%" >nul || exit /b 21
fc /b "%B%\%T%" "%T%" >nul || exit /b 22
echo [OK] Analytics 2.0 fix rollback complete.
echo Next: npm run build
