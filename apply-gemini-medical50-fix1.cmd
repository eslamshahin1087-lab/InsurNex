@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini50-fix1-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\medical-intelligence" >nul 2>&1
copy /y src\features\medical-intelligence\gemini-medical.client.ts "%B%\src\features\medical-intelligence\gemini-medical.client.ts" >nul || exit /b 12
copy /y patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 13
fc /b patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 14
echo [OK] Gemini 5.0 Firebase app binding fixed.
echo [OK] Reuses the already initialized default Firebase app.
echo Next: npm run build
