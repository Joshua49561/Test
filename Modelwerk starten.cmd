@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js 22 oder neuer installieren: https://nodejs.org/
  pause
  exit /b 1
)
node server.mjs --open
if errorlevel 1 pause
