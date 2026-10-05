@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical42-backup"
if not exist "%B%\src\pages\MedicalIntelligencePage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul
del /q src\features\medical-intelligence\medical42.types.ts src\features\medical-intelligence\medical42.schema.ts src\features\medical-intelligence\medical42.engine.ts src\features\medical-intelligence\medical42-report.service.ts src\theme\medical42.css 2>nul
echo [OK] Medical Intelligence 4.2 rollback complete.
echo Next: npm run build
