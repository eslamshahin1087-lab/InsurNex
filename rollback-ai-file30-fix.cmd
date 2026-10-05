@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-ai-file30-fix-backup"
if not exist "%B%\src\features\ai\file-analysis.engine.ts" (echo [ERROR] Fix backup not found.& exit /b 20)
copy /y "%B%\src\features\ai\file-analysis.engine.ts" src\features\ai\file-analysis.engine.ts >nul || exit /b 21
copy /y "%B%\src\features\ai\file-parser.service.ts" src\features\ai\file-parser.service.ts >nul || exit /b 22
echo [OK] AI File Intelligence 3.0 fix rollback complete.
echo Next: npm run build
