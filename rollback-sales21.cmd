@echo off
setlocal EnableExtensions
set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
set "BACKUPFILE=%PROJECT%\.insurnex-sales21-insurer-backup\src\pages\LeadsPage.tsx"
set "TARGET=%PROJECT%\src\pages\LeadsPage.tsx"
if not exist "%BACKUPFILE%" (
  echo [ERROR] Backup file not found: %BACKUPFILE%
  exit /b 20
)
copy /y "%BACKUPFILE%" "%TARGET%" >nul
if errorlevel 1 (
  echo [ERROR] Rollback copy failed.
  exit /b 21
)
fc /b "%BACKUPFILE%" "%TARGET%" >nul
if errorlevel 1 (
  echo [ERROR] Rollback verification failed.
  exit /b 22
)
echo [OK] Sales 2.1 rollback completed and verified.
echo Next command: npm run build
exit /b 0
