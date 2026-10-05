@echo off
setlocal EnableExtensions
set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
set "BACKUP=%PROJECT%\.insurnex-leads-sales21-repair-backup"
if not exist "%BACKUP%\src\App.tsx" (echo [ERROR] Repair backup not found.& exit /b 20)
copy /y "%BACKUP%\src\App.tsx" "%PROJECT%\src\App.tsx" >nul || exit /b 21
if exist "%BACKUP%\src\pages\LeadsPage.tsx" (copy /y "%BACKUP%\src\pages\LeadsPage.tsx" "%PROJECT%\src\pages\LeadsPage.tsx" >nul) else (if exist "%PROJECT%\src\pages\LeadsPage.tsx" del /q "%PROJECT%\src\pages\LeadsPage.tsx")
echo [OK] Repair rollback complete.
echo Next: npm run build
