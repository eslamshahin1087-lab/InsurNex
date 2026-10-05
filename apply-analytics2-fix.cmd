@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-analytics2-fix-backup"
set "T=src\features\analytics\analytics.service.ts"
set "S=patch\src\features\analytics\analytics.service.ts"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if not exist "%T%" (echo [ERROR] Current analytics.service.ts not found.& exit /b 11)
if not exist "%S%" (echo [ERROR] Fix source missing.& exit /b 12)
if exist "%B%" (echo [ERROR] Fix backup exists: %B%& exit /b 13)
mkdir "%B%\src\features\analytics" >nul 2>&1
copy /y "%T%" "%B%\%T%" >nul || exit /b 14
copy /y "%S%" "%T%" >nul || exit /b 15
fc /b "%S%" "%T%" >nul || (echo [ERROR] Verification failed.& exit /b 16)
echo [OK] Analytics 2.0 TypeScript fix applied and verified.
echo [OK] Removed unused LeadStage import using full-file replacement.
echo Next: npm run build
exit /b 0
