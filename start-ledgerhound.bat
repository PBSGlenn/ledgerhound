@echo off
echo Starting Ledgerhound...
cd /d "%~dp0"

REM Start API server in a new window
start "Ledgerhound API" cmd /k npm run api

REM Wait 3 seconds for API to start
timeout /t 3 /nobreak

REM Start Tauri app in a new window
start "Ledgerhound App" cmd /k npm run tauri:dev

echo Ledgerhound is starting...
echo API server window and Tauri app window have been opened.
pause
