@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical52-backup"
if not exist "%B%\src\features\medical-intelligence\medical42.engine.ts" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\features\medical-intelligence\medical42.engine.ts" src\features\medical-intelligence\medical42.engine.ts >nul
copy /y "%B%\src\features\medical-intelligence\gemini-medical.client.ts" src\features\medical-intelligence\gemini-medical.client.ts >nul
echo [OK] Medical 5.2 rollback complete.
