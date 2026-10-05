@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "B=.insurnex-claude-backend-backup"
if exist "%B%\functions" (rmdir /s /q functions & xcopy /e /i /q /y "%B%\functions" functions >nul) else (rmdir /s /q functions 2>nul)
del /q src\features\medical-intelligence\claude-medical.client.ts 2>nul
echo [OK] Claude backend layer rollback complete.
