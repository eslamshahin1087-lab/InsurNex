@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical43-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 12
copy /y patch\src\features\medical-intelligence\medical43.types.ts src\features\medical-intelligence\medical43.types.ts >nul || exit /b 13
copy /y patch\src\features\medical-intelligence\medical43.schema.ts src\features\medical-intelligence\medical43.schema.ts >nul || exit /b 14
copy /y patch\src\features\medical-intelligence\medical43.engine.ts src\features\medical-intelligence\medical43.engine.ts >nul || exit /b 15
copy /y patch\src\features\medical-intelligence\medical43-report.service.ts src\features\medical-intelligence\medical43-report.service.ts >nul || exit /b 16
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 17
copy /y patch\src\theme\medical43.css src\theme\medical43.css >nul || exit /b 18
echo [OK] Medical Intelligence 4.3 applied.
echo [OK] Real medical schema mapping + advanced engines enabled.
echo Next: npm run build
