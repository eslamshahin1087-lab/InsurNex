@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-appcheck-config-fix-backup"
if not exist "%B%\src\firebase\config.ts" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\firebase\config.ts" src\firebase\config.ts >nul || exit /b 21
echo [OK] Firebase config rollback complete.
