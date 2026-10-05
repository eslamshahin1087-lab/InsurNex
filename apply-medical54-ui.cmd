@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical54-ui-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if not exist src\features\medical-intelligence\Medical54Advanced.tsx (echo [ERROR] Medical 5.4 Core is missing.& exit /b 11)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 12)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 13
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 14
fc /b patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 15
echo [OK] Medical Intelligence 5.4 UI integration applied.
echo [OK] Advanced analytics now render before Gemini Executive Intelligence.
echo Next: npm run build
