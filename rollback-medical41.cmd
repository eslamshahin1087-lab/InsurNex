@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical41-backup"
if not exist "%B%\src\App.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\App.tsx" src\App.tsx >nul
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul
del /q src\features\medical-intelligence\medical-report.service.ts src\theme\medical41.css 2>nul
echo [OK] Medical Intelligence 4.1 rollback complete.
echo Next: npm run build
