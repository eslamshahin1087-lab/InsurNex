@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini53-ui-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 12
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 13
copy /y patch\src\theme\gemini-medical53.css src\theme\gemini-medical53.css >nul || exit /b 14
echo [OK] Gemini Medical 5.3 UI applied.
echo [OK] Arabic text repaired and progress states connected.
echo Next: npm run build
