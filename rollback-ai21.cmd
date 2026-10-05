@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai21-backup"
if not exist "%B%\src\App.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\App.tsx" src\App.tsx >nul
del /q src\features\ai\client-insurance-analysis.service.ts src\features\ai\ai-report.schema.ts src\pages\ClientInsuranceAnalysisPage.tsx src\theme\ai-intelligence21.css 2>nul
echo [OK] AI Intelligence 2.1 rollback complete.
echo Next: npm run build
