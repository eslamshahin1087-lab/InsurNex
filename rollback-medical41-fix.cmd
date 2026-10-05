@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical41-fix-backup"
if not exist "%B%\src\pages\MedicalIntelligencePage.tsx" (echo [ERROR] Backup missing.& exit /b 20)
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul
echo [OK] Fix rolled back.
