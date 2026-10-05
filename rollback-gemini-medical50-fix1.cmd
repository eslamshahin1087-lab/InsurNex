@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini50-fix1-backup"
if not exist "%B%\src\features\medical-intelligence\gemini-medical.client.ts" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\features\medical-intelligence\gemini-medical.client.ts" src\features\medical-intelligence\gemini-medical.client.ts >nul
echo [OK] Gemini fix rollback complete.
