@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge43-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul || exit /b 12
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 13
copy /y patch\src\theme\ai-medical-bridge43.css src\theme\ai-medical-bridge43.css >nul || exit /b 14
echo [OK] AI File Analysis / Medical Intelligence bridge applied.
echo [OK] Arabic / English selector added to general AI page.
echo [OK] Medical files now show specialist routing action.
echo Next: npm run build
