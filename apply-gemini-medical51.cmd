@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini51-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\medical-intelligence" >nul 2>&1
copy /y src\features\medical-intelligence\gemini-medical.client.ts "%B%\src\features\medical-intelligence\gemini-medical.client.ts" >nul || exit /b 12
copy /y patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 13
fc /b patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 14
echo [OK] Gemini Medical 5.1 resilience applied.
echo [OK] Retry on 408, 429 and 5xx plus Flash-Lite fallback enabled.
echo Next: npm run build
