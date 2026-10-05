@echo off
setlocal EnableExtensions

set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
set "SOURCE=%PROJECT%\patch\src\pages\LeadsPage.tsx"
set "TARGET=%PROJECT%\src\pages\LeadsPage.tsx"
set "BACKUP=%PROJECT%\.insurnex-sales21-insurer-backup"
set "BACKUPFILE=%BACKUP%\src\pages\LeadsPage.tsx"

if not exist "%PROJECT%\package.json" (
  echo [ERROR] package.json not found in: %PROJECT%
  exit /b 10
)
if not exist "%SOURCE%" (
  echo [ERROR] Patch source not found: %SOURCE%
  exit /b 11
)
if not exist "%TARGET%" (
  echo [ERROR] Current LeadsPage not found: %TARGET%
  exit /b 12
)

if exist "%BACKUP%" (
  if exist "%BACKUPFILE%" (
    echo [INFO] Existing valid backup will be preserved.
  ) else (
    echo [ERROR] Backup folder exists but backup file is missing: %BACKUPFILE%
    exit /b 13
  )
) else (
  mkdir "%BACKUP%\src\pages" >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Could not create backup directory: %BACKUP%\src\pages
    exit /b 14
  )
  copy /y "%TARGET%" "%BACKUPFILE%" >nul
  if errorlevel 1 (
    echo [ERROR] Could not create backup: %BACKUPFILE%
    exit /b 15
  )
  echo [OK] Backup created.
)

copy /y "%SOURCE%" "%TARGET%" >nul
if errorlevel 1 (
  echo [ERROR] Could not copy patched LeadsPage.tsx to project.
  exit /b 16
)

fc /b "%SOURCE%" "%TARGET%" >nul
if errorlevel 1 (
  echo [ERROR] Verification failed. Target differs from patch source.
  exit /b 17
)

echo [OK] Sales 2.1 insurer integration applied and verified.
echo [OK] Backup: .insurnex-sales21-insurer-backup
echo Next command: npm run build
exit /b 0
