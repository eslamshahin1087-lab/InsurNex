@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file32-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\ai" "%B%\src\pages" "%B%\src\theme" >nul 2>&1
for %%F in (src\features\ai\file-parser.service.ts src\features\ai\file-analysis.engine.ts src\pages\AIFileAnalysisPage.tsx src\theme\ai-file30.css) do if not exist "%%F" (echo [ERROR] Missing %%F& exit /b 12)
copy /y src\features\ai\file-parser.service.ts "%B%\src\features\ai\file-parser.service.ts" >nul
copy /y src\features\ai\file-analysis.engine.ts "%B%\src\features\ai\file-analysis.engine.ts" >nul
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul
copy /y src\theme\ai-file30.css "%B%\src\theme\ai-file30.css" >nul
copy /y patch\src\features\ai\file-parser.service.ts src\features\ai\file-parser.service.ts >nul || exit /b 13
copy /y patch\src\features\ai\file-analysis.engine.ts src\features\ai\file-analysis.engine.ts >nul || exit /b 14
copy /y patch\src\features\ai\interactive-report.service.ts src\features\ai\interactive-report.service.ts >nul || exit /b 15
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 16
copy /y patch\src\theme\ai-file30.css src\theme\ai-file30.css >nul || exit /b 17
echo [OK] AI File Intelligence 3.2 applied.
echo [OK] Arabic interactive insurance report enabled.
echo Next: npm run build
