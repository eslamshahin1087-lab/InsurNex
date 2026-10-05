@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-medical55-suite-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\features\medical-intelligence" >nul 2>&1
for %%F in (medical54.engine.ts gemini-medical.client.ts) do if exist "src\features\medical-intelligence\%%F" copy /y "src\features\medical-intelligence\%%F" "%B%\src\features\medical-intelligence\%%F" >nul
for %%F in (medical54.engine.ts gemini-medical.client.ts pharmacy55.engine.ts case55.engine.ts renewal55.engine.ts executive-report55.ts) do copy /y "patch\src\features\medical-intelligence\%%F" "src\features\medical-intelligence\%%F" >nul || exit /b 12
echo [OK] Medical Intelligence advanced suite applied.
echo [OK] Steps 1-5 installed: Gemini context, Pharmacy, Case Management, Renewal, Executive Report data model.
echo Next: npm run build
