@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge44-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul || exit /b 12
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 13
copy /y patch\src\theme\ai-medical-bridge44.css src\theme\ai-medical-bridge44.css >nul || exit /b 14
echo [OK] AI / Medical bridge 4.4 layout applied.
echo [OK] Responsive mapping cards and medical routing polished.
echo Next: npm run build
