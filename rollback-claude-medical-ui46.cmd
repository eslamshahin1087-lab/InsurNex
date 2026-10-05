@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-claude-ui46-backup"
if not exist "%B%\src\pages\MedicalIntelligencePage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul
del /q src\theme\claude-medical46.css 2>nul
echo [OK] Claude UI rollback complete.
