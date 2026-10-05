@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file31-entry-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" "%B%\src\theme" >nul 2>&1
for %%F in (src\pages\AnalyticsPage.tsx src\pages\AIFileAnalysisPage.tsx src\theme\analytics2.css src\theme\ai-file30.css) do if not exist "%%F" (echo [ERROR] Missing %%F& exit /b 12)
copy /y src\pages\AnalyticsPage.tsx "%B%\src\pages\AnalyticsPage.tsx" >nul
copy /y src\pages\AIFileAnalysisPage.tsx "%B%\src\pages\AIFileAnalysisPage.tsx" >nul
copy /y src\theme\analytics2.css "%B%\src\theme\analytics2.css" >nul
copy /y src\theme\ai-file30.css "%B%\src\theme\ai-file30.css" >nul
copy /y patch\src\pages\AnalyticsPage.tsx src\pages\AnalyticsPage.tsx >nul || exit /b 13
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 14
copy /y patch\src\theme\analytics2.css src\theme\analytics2.css >nul || exit /b 15
copy /y patch\src\theme\ai-file30.css src\theme\ai-file30.css >nul || exit /b 16
echo [OK] AI File Intelligence 3.1 entry UX applied.
echo [OK] Analytics now includes an AI Studio launch card.
echo [OK] File analyzer now includes a professional upload workspace.
echo Next: npm run build
