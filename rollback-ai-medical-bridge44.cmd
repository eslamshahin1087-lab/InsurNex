@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge44-backup"
if not exist "%B%\src\pages\AIFileAnalysisPage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul
del /q src\theme\ai-medical-bridge44.css 2>nul
echo [OK] Bridge 4.4 rollback complete.
echo Next: npm run build
