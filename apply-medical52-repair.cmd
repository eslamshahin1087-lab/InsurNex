@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical52-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\medical-intelligence" >nul 2>&1
copy /y src\features\medical-intelligence\medical42.engine.ts "%B%\src\features\medical-intelligence\medical42.engine.ts" >nul || exit /b 12
copy /y src\features\medical-intelligence\gemini-medical.client.ts "%B%\src\features\medical-intelligence\gemini-medical.client.ts" >nul || exit /b 13
copy /y patch\src\features\medical-intelligence\medical42.engine.ts src\features\medical-intelligence\medical42.engine.ts >nul || exit /b 14
copy /y patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 15
echo [OK] Medical Intelligence 5.2 repair applied.
echo [OK] Excel serial date repair + Gemini resilience installed.
echo Next: npm run build
