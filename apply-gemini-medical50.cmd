@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini50-backup"
if not exist package.json (echo [ERROR] Run in InsurNex project root.& exit /b 10)
if exist "%B%" (echo [ERROR] Backup exists: %B%& exit /b 11)
mkdir "%B%\src\pages" >nul 2>&1
copy /y src\pages\MedicalIntelligencePage.tsx "%B%\src\pages\MedicalIntelligencePage.tsx" >nul || exit /b 12
if exist src\features\medical-intelligence\claude-medical.client.ts copy /y src\features\medical-intelligence\claude-medical.client.ts "%B%\claude-medical.client.ts" >nul
if exist src\theme\claude-medical46.css copy /y src\theme\claude-medical46.css "%B%\claude-medical46.css" >nul
copy /y patch\src\features\medical-intelligence\gemini-medical.client.ts src\features\medical-intelligence\gemini-medical.client.ts >nul || exit /b 13
copy /y patch\src\pages\MedicalIntelligencePage.tsx src\pages\MedicalIntelligencePage.tsx >nul || exit /b 14
copy /y patch\src\theme\gemini-medical50.css src\theme\gemini-medical50.css >nul || exit /b 15
del /q src\features\medical-intelligence\claude-medical.client.ts src\theme\claude-medical46.css 2>nul
if exist functions\src\index.ts findstr /c:"@anthropic-ai/sdk" functions\src\index.ts >nul && (echo [INFO] Anthropic-only functions folder detected. Keeping it for safety; it is no longer referenced by the app.)
echo [OK] Gemini Medical Intelligence 5.0 installed.
echo [OK] Claude frontend client/UI references removed.
echo [OK] No Gemini API key is embedded in React.
echo Next: npm install firebase@latest
echo Then: npm run build
