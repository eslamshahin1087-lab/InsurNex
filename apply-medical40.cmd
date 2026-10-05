@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical40-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%" >nul 2>&1
if not exist src\features\medical-intelligence mkdir src\features\medical-intelligence
copy /y patch\src\features\medical-intelligence\*.ts src\features\medical-intelligence\ >nul || exit /b 12
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 13
copy /y patch\src\theme\medical40.css src\theme\medical40.css >nul || exit /b 14
echo [OK] Medical Intelligence 4.0 core installed.
echo Next: npm run build
