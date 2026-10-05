@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-appcheck-config-fix-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\firebase" >nul 2>&1
copy /y src\firebase\config.ts "%B%\src\firebase\config.ts" >nul || exit /b 12
copy /y patch\src\firebase\config.ts src\firebase\config.ts >nul || exit /b 13
fc /b patch\src\firebase\config.ts src\firebase\config.ts >nul || exit /b 14
echo [OK] Firebase App Check config repaired with a verified full file.
echo Next: npm run build
