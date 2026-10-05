@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-gemini50-backup"
if not exist "%B%\src\pages\MedicalIntelligencePage.tsx" (echo [ERROR] Backup not found.& exit /b 20)
copy /y "%B%\src\pages\MedicalIntelligencePage.tsx" src\pages\MedicalIntelligencePage.tsx >nul
if exist "%B%\claude-medical.client.ts" copy /y "%B%\claude-medical.client.ts" src\features\medical-intelligence\claude-medical.client.ts >nul
if exist "%B%\claude-medical46.css" copy /y "%B%\claude-medical46.css" src\theme\claude-medical46.css >nul
del /q src\features\medical-intelligence\gemini-medical.client.ts src\theme\gemini-medical50.css 2>nul
echo [OK] Gemini 5.0 rollback complete.
