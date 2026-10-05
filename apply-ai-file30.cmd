@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file30-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src" >nul 2>&1
copy /y src\App.tsx "%B%\src\App.tsx" >nul || exit /b 12
call npm install xlsx pdfjs-dist jspdf --save
if errorlevel 1 (echo [ERROR] npm install failed.& exit /b 13)
copy /y patch\src\App.tsx src\App.tsx >nul || exit /b 14
if not exist src\features\ai mkdir src\features\ai
copy /y patch\src\features\ai\file-parser.service.ts src\features\ai\file-parser.service.ts >nul || exit /b 15
copy /y patch\src\features\ai\file-analysis.engine.ts src\features\ai\file-analysis.engine.ts >nul || exit /b 16
copy /y patch\src\features\ai\report-pdf.service.ts src\features\ai\report-pdf.service.ts >nul || exit /b 17
copy /y patch\src\pages\AIFileAnalysisPage.tsx src\pages\AIFileAnalysisPage.tsx >nul || exit /b 18
copy /y patch\src\theme\ai-file30.css src\theme\ai-file30.css >nul || exit /b 19
fc /b patch\src\App.tsx src\App.tsx >nul || exit /b 20
echo [OK] AI File Intelligence 3.0 applied.
echo Route: /ai/file-analysis
echo Next: npm run build
