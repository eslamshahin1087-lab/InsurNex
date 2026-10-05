@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file33-backup"
if not exist "%B%\src\pages\AIFileAnalysisPage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul
del /q src\features\ai\column-mapping.engine.ts src\features\ai\mapped-analysis.service.ts src\theme\ai-file33.css 2>nul
echo [OK] Rollback complete.
echo Next: npm run build
