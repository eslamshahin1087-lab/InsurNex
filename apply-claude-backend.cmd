@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-claude-backend-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%" >nul 2>&1
if exist functions (xcopy /e /i /q /y functions "%B%\functions" >nul)
mkdir functions\src >nul 2>&1
copy /y patch\functions\package.json functions\package.json >nul
copy /y patch\functions\tsconfig.json functions\tsconfig.json >nul
copy /y patch\functions\src\index.ts functions\src\index.ts >nul
copy /y patch\src\features\medical-intelligence\claude-medical.client.ts src\features\medical-intelligence\claude-medical.client.ts >nul
powershell -NoProfile -Command "$p='firebase.json';$j=Get-Content $p -Raw|ConvertFrom-Json;if(-not $j.functions){$j|Add-Member -NotePropertyName functions -NotePropertyValue ([pscustomobject]@{source='functions'})};$j|ConvertTo-Json -Depth 20|Set-Content $p -Encoding utf8"
echo [OK] Secure Claude backend layer installed.
echo Next: cd functions ^&^& npm install ^&^& npm run build
