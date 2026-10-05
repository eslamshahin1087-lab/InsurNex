@echo off
setlocal EnableExtensions
cd /d "%~dp0"
del /q src\features\medical-intelligence\medical.types.ts src\features\medical-intelligence\medical-normalizer.ts src\features\medical-intelligence\medical-analytics.engine.ts src\features\medical-intelligence\medical-benchmark.ts src\pages\MedicalIntelligencePage.tsx src\theme\medical40.css 2>nul
echo [OK] Medical Intelligence 4.0 core removed.
echo Next: npm run build
