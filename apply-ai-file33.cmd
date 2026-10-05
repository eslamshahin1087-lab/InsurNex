@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file33-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul || exit /b 12
copy /y patch\src\features\ai\column-mapping.engine.ts src\features\ai\column-mapping.engine.ts >nul || exit /b 13
copy /y patch\src\features\ai\mapped-analysis.service.ts src\features\ai\mapped-analysis.service.ts >nul || exit /b 14
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 15
copy /y patch\src\theme\ai-file33.css src\theme\ai-file33.css >nul || exit /b 16
echo [OK] AI File Intelligence 3.3 applied.
echo [OK] Data preview and column mapping enabled.
echo Next: npm run build
