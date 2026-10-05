@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini51-backup"
if not exist "%B%\src\features\medical-intelligence\gemini-medical.client.ts" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\features\medical-intelligence\gemini-medical.client.ts" src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 21
echo [OK] Gemini Medical 5.1 rollback complete.
