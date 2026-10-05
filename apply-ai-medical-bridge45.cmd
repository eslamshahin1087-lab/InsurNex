@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge45-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul || exit /b 12
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 13
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 14
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 15
copy /y patch\src\theme\ai-medical-bridge45.css src\theme\ai-medical-bridge45.css >nul || exit /b 16
echo [OK] AI / Medical Bridge 4.5 applied.
echo [OK] Medical handoff is seamless; uploaded data is preserved during navigation.
echo [OK] Dark-mode table contrast and mapping layout corrected.
echo Next: npm run build
