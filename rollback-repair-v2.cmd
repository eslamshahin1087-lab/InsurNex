@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "BACKUP=.insurnex-leads-sales21-repair-v2-backup"
if not exist "%BACKUP%\src\App.tsx" (echo [ERROR] V2 backup not found.& exit /b 20)
copy /y "%BACKUP%\src\App.tsx" src\App.tsx >nul || exit /b 21
if exist "%BACKUP%\src\pages\LeadsPage.tsx" (copy /y "%BACKUP%\src\pages\LeadsPage.tsx" src\pages\LeadsPage.tsx >nul) else (if exist src\pages\LeadsPage.tsx del /q src\pages\LeadsPage.tsx)
echo [OK] Repair V2 rollback complete.
echo Next: npm run build
