@echo off
setlocal EnableExtensions
set "PROJECT=%~dp0"
if "%PROJECT:~-1%"=="\" set "PROJECT=%PROJECT:~0,-1%"
set "SOURCE=%PROJECT%\patch\src\pages\LeadsPage.tsx"
set "TARGET=%PROJECT%\src\pages\LeadsPage.tsx"
set "APP=%PROJECT%\src\App.tsx"
set "BACKUP=%PROJECT%\.insurnex-leads-sales21-repair-backup"
if not exist "%PROJECT%\package.json" (echo [ERROR] package.json not found.& exit /b 10)
if not exist "%SOURCE%" (echo [ERROR] Repair source not found.& exit /b 11)
if not exist "%APP%" (echo [ERROR] src\App.tsx not found.& exit /b 12)
if exist "%BACKUP%" (echo [ERROR] Repair backup already exists. Use rollback first if reapplying.& exit /b 13)
mkdir "%BACKUP%\src\pages" >nul 2>&1
copy /y "%APP%" "%BACKUP%\src\App.tsx" >nul || exit /b 14
if exist "%TARGET%" copy /y "%TARGET%" "%BACKUP%\src\pages\LeadsPage.tsx" >nul
copy /y "%SOURCE%" "%TARGET%" >nul || exit /b 15
fc /b "%SOURCE%" "%TARGET%" >nul || (echo [ERROR] LeadsPage verification failed.& exit /b 16)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%APP%';$s=[IO.File]::ReadAllText($p);if($s -notmatch 'const LeadsPage = lazy'){ $marker='const MorePage = lazy('; $insert=\"const LeadsPage = lazy(`r`n  () => import('./pages/LeadsPage'),`r`n);`r`n`r`nconst LeadDetailsPage = lazy(`r`n  () => import('./pages/LeadDetailsPage'),`r`n);`r`n`r`n\"; if(-not $s.Contains($marker)){throw 'APP_IMPORT_ANCHOR_NOT_FOUND'};$s=$s.Replace($marker,$insert+$marker)};$pattern='(?s)<Route\s+path=\"leads\"\s+element=\{<ComingSoonPage />\}\s+/>\s*';$replacement='<Route path=\"leads\" element={<LeadsPage />} />`r`n                <Route path=\"leads/:id\" element={<LeadDetailsPage />} />`r`n`r`n                ';$n=[regex]::Matches($s,$pattern).Count;if($n -ne 1){throw ('LEADS_ROUTE_MATCH_COUNT_'+$n)};$s=[regex]::Replace($s,$pattern,$replacement,1);[IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))"
if errorlevel 1 (echo [ERROR] App.tsx routing update failed. Backup preserved.& exit /b 17)
findstr /C:"const LeadsPage = lazy" "%APP%" >nul || (echo [ERROR] LeadsPage lazy import verification failed.& exit /b 18)
findstr /C:"path=\"leads/:id\"" "%APP%" >nul || (echo [ERROR] Lead details route verification failed.& exit /b 19)
echo [OK] LeadsPage restored, Sales 2.1 insurer integration applied, routes restored.
echo [OK] Backup: .insurnex-leads-sales21-repair-backup
echo Next: npm run build
exit /b 0
