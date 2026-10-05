@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file30-backup"
if not exist "%B%\src\App.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\App.tsx" src\App.tsx >nul
del /q src\features\ai\file-parser.service.ts src\features\ai\file-analysis.engine.ts src\features\ai\report-pdf.service.ts src\pages\AIFileAnalysisPage.tsx src\theme\ai-file30.css 2>nul
echo [OK] AI File Intelligence 3.0 files rolled back.
echo Note: npm dependencies are intentionally retained.
echo Next: npm run build
