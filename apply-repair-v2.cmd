@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "BACKUP=.insurnex-leads-sales21-repair-v2-backup"
if not exist package.json (echo [ERROR] Run from extracted package in InsurNex project root.& exit /b 10)
if not exist patch\src\App.tsx (echo [ERROR] patch\src\App.tsx missing.& exit /b 11)
if not exist patch\src\pages\LeadsPage.tsx (echo [ERROR] patched LeadsPage.tsx missing.& exit /b 12)
if not exist src\pages\LeadDetailsPage.tsx (echo [ERROR] LeadDetailsPage.tsx missing. Stop without changes.& exit /b 13)
if exist "%BACKUP%" (echo [ERROR] Backup already exists: %BACKUP%& exit /b 14)
mkdir "%BACKUP%\src\pages" >nul 2>&1
copy /y src\App.tsx "%BACKUP%\src\App.tsx" >nul || exit /b 15
if exist src\pages\LeadsPage.tsx copy /y src\pages\LeadsPage.tsx "%BACKUP%\src\pages\LeadsPage.tsx" >nul
copy /y patch\src\App.tsx src\App.tsx >nul || exit /b 16
copy /y patch\src\pages\LeadsPage.tsx src\pages\LeadsPage.tsx >nul || exit /b 17
fc /b patch\src\App.tsx src\App.tsx >nul || (echo [ERROR] App.tsx verification failed.& exit /b 18)
fc /b patch\src\pages\LeadsPage.tsx src\pages\LeadsPage.tsx >nul || (echo [ERROR] LeadsPage.tsx verification failed.& exit /b 19)
echo [OK] Repair V2 applied and verified.
echo [OK] Restored /leads and /leads/:id routes.
echo [OK] Sales 2.1 insurer dropdown installed.
echo Next: npm run build
exit /b 0
