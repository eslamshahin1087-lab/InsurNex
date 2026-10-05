@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical54-fix1-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\medical-intelligence" >nul 2>&1
copy /y src\features\medical-intelligence\medical54.engine.ts "%B%\src\features\medical-intelligence\medical54.engine.ts" >nul || exit /b 12
copy /y patch\src\features\medical-intelligence\medical54.engine.ts src\features\medical-intelligence\medical54.engine.ts >nul || exit /b 13
fc /b patch\src\features\medical-intelligence\medical54.engine.ts src\features\medical-intelligence\medical54.engine.ts >nul || exit /b 14
echo [OK] Medical Intelligence 5.4 TypeScript fix applied.
echo [OK] trendSignals is now typed as string[].
echo Next: npm run build
