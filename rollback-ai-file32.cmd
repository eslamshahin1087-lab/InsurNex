@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file32-backup"
if not exist "%B%\src\pages\AIFileAnalysisPage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\features\ai\file-parser.service.ts" src\features\ai\file-parser.service.ts >nul
copy /y "%B%\src\features\ai\file-analysis.engine.ts" src\features\ai\file-analysis.engine.ts >nul
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul
copy /y "%B%\src\theme\ai-file30.css" src\theme\ai-file30.css >nul
del /q src\features\ai\interactive-report.service.ts 2>nul
echo [OK] AI File Intelligence 3.2 rollback complete.
echo Next: npm run build
