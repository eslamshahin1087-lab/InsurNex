@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical54-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%" >nul 2>&1
copy /y patch\src\features\medical-intelligence\medical54.engine.ts src\features\medical-intelligence\medical54.engine.ts >nul || exit /b 12
copy /y patch\src\features\medical-intelligence\Medical54Advanced.tsx src\features\medical-intelligence\Medical54Advanced.tsx >nul || exit /b 13
copy /y patch\src\theme\medical54.css src\theme\medical54.css >nul || exit /b 14
echo [OK] Medical Intelligence 5.4 analytics modules installed.
echo [OK] Existing 5.3 page remains untouched for stability.
echo Next: npm run build
