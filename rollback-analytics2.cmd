@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-analytics2-backup"
if not exist "%B%\src\App.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\App.tsx" src\App.tsx >nul
del /q src\features\analytics\analytics.service.ts src\features\analytics\insurance-ai.service.ts src\pages\AnalyticsPage.tsx src\theme\analytics2.css 2>nul
echo [OK] Analytics 2.0 rollback complete.
echo Next: npm run build
