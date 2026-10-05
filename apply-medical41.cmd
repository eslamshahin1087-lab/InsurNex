@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical41-backup"
if not exist package.json (echo [ERROR] Run in project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 12
copy /y src\App.tsx "%B%\src\App.tsx" >nul || exit /b 13
copy /y patch\src\features\medical-intelligence\medical-report.service.ts src\features\medical-intelligence\medical-report.service.ts >nul || exit /b 14
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 15
copy /y patch\src\theme\medical41.css src\theme\medical41.css >nul || exit /b 16
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='src/App.tsx';$s=[IO.File]::ReadAllText($p);if($s -notmatch 'MedicalIntelligencePage'){if($s -match 'const AnalyticsPage=lazy'){ $s=$s -replace 'const AnalyticsPage=lazy', 'const MedicalIntelligencePage=lazy(()=>import(''./pages/MedicalIntelligencePage''));const AnalyticsPage=lazy' } else { throw 'Analytics lazy anchor not found' };if($s -match '<Route path=\"analytics\" element=\{<AnalyticsPage/>\}/>'){ $s=$s -replace '<Route path=\"analytics\" element=\{<AnalyticsPage/>\}/>', '<Route path=\"analytics\" element={<AnalyticsPage/>}/><Route path=\"analytics/medical\" element={<MedicalIntelligencePage/>}/>' } else { throw 'Analytics route anchor not found' };[IO.File]::WriteAllText($p,$s,(New-Object Text.UTF8Encoding($false)))}"
if errorlevel 1 (copy /y "%B%\src\App.tsx" src\App.tsx >nul & echo [ERROR] App integration failed; App.tsx restored. & exit /b 17)
echo [OK] Medical Intelligence 4.1 integrated.
echo Route: /analytics/medical
echo [OK] English Medical PDF report enabled.
echo Next: npm run build
