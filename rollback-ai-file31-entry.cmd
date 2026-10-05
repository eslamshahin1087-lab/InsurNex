@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file31-entry-backup"
if not exist "%B%\src\pages\AnalyticsPage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\AnalyticsPage.tsx" src\pages\AnalyticsPage.tsx >nul
copy /y "%B%\src\pages\AIFileAnalysisPage.tsx" src\pages\AIFileAnalysisPage.tsx >nul
copy /y "%B%\src\theme\analytics2.css" src\theme\analytics2.css >nul
copy /y "%B%\src\theme\ai-file30.css" src\theme\ai-file30.css >nul
echo [OK] AI File Intelligence 3.1 entry UX rollback complete.
echo Next: npm run build
