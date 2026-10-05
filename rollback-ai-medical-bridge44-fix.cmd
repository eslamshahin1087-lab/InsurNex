@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge44-fix-backup"
if not exist "%B%\src\pages\AIFileAnalysisPage.tsx" (echo [ERROR] Fix backup not found.& exit /b 20)
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul || exit /b 21
echo [OK] AI Medical Bridge 4.4 fix rollback complete.
echo Next: npm run build
