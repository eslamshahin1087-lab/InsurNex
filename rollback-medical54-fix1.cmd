@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical54-fix1-backup"
if not exist "%B%\src\features\medical-intelligence\medical54.engine.ts" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\features\medical-intelligence\medical54.engine.ts" src\features\medical-intelligence\medical54.engine.ts >nul || exit /b 21
echo [OK] Medical 5.4 fix rollback complete.
