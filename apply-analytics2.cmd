@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-analytics2-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\analytics" "%B%\src\pages" "%B%\src\theme" >nul 2>&1
copy /y src\App.tsx "%B%\src\App.tsx" >nul || exit /b 12
copy /y patch\src\App.tsx src\App.tsx >nul || exit /b 13
if not exist src\features\analytics mkdir src\features\analytics
copy /y patch\src\features\analytics\analytics.service.ts src\features\analytics\analytics.service.ts >nul || exit /b 14
copy /y patch\src\features\analytics\insurance-ai.service.ts src\features\analytics\insurance-ai.service.ts >nul || exit /b 15
copy /y patch\src\pages\AnalyticsPage.tsx src\pages\AnalyticsPage.tsx >nul || exit /b 16
copy /y patch\src\theme\analytics2.css src\theme\analytics2.css >nul || exit /b 17
fc /b patch\src\App.tsx src\App.tsx >nul || exit /b 18
echo [OK] Analytics 2.0 applied and verified.
echo Next: npm run build
