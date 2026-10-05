@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file30-fix-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Fix backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\ai" >nul 2>&1
copy /y src\features\ai\file-analysis.engine.ts "%B%\src\features\ai\file-analysis.engine.ts" >nul || exit /b 12
copy /y src\features\ai\file-parser.service.ts "%B%\src\features\ai\file-parser.service.ts" >nul || exit /b 13
copy /y patch\src\features\ai\file-analysis.engine.ts src\features\ai\file-analysis.engine.ts >nul || exit /b 14
copy /y patch\src\features\ai\file-parser.service.ts src\features\ai\file-parser.service.ts >nul || exit /b 15
fc /b patch\src\features\ai\file-analysis.engine.ts src\features\ai\file-analysis.engine.ts >nul || exit /b 16
fc /b patch\src\features\ai\file-parser.service.ts src\features\ai\file-parser.service.ts >nul || exit /b 17
echo [OK] AI File Intelligence 3.0 fix applied and verified.
echo [OK] Numeric typing fixed.
echo [OK] PDF.js worker configuration updated.
echo Next: npm run build
