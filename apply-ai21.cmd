@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai21-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\App.tsx "%B%\src\App.tsx" >nul || exit /b 12
copy /y patch\src\App.tsx src\App.tsx >nul || exit /b 13
if not exist src\features\ai mkdir src\features\ai
copy /y patch\src\features\ai\client-insurance-analysis.service.ts src\features\ai\client-insurance-analysis.service.ts >nul || exit /b 14
copy /y patch\src\features\ai\ai-report.schema.ts src\features\ai\ai-report.schema.ts >nul || exit /b 15
copy /y patch\src\pages\ClientInsuranceAnalysisPage.tsx src\pages\ClientInsuranceAnalysisPage.tsx >nul || exit /b 16
copy /y patch\src\theme\ai-intelligence21.css src\theme\ai-intelligence21.css >nul || exit /b 17
fc /b patch\src\App.tsx src\App.tsx >nul || exit /b 18
echo [OK] AI Intelligence 2.1 applied and verified.
echo Route: /clients/:id/insurance-analysis
echo Next: npm run build
