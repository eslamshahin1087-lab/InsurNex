@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical54-ui-backup"
if not exist "%B%\src\pages\MedicalIntelligencePage.tsx" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul || exit /b 21
echo [OK] Medical 5.4 UI rollback complete.
