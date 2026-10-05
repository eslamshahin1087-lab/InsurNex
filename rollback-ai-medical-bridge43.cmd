@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-medical-bridge43-backup"
if not exist "%B%\src\pages\AIFileAnalysisPage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul
del /q src\theme\ai-medical-bridge43.css 2>nul
echo [OK] Bridge rollback complete.
echo Next: npm run build
