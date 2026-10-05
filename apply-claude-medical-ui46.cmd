@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-claude-ui46-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 12
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 13
copy /y patch\src\theme\claude-medical46.css src\theme\claude-medical46.css >nul || exit /b 14
echo [OK] Claude Medical Intelligence UI 4.6 applied.
echo Next: npm run build
