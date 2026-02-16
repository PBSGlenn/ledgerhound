@echo off
title Ledgerhound - Installation
cd /d "%~dp0"

echo ==========================================
echo   Ledgerhound - First Time Installation
echo ==========================================
echo.

REM Check Node.js is available
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH.
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)
echo Done.
echo.

echo [2/4] Setting up database...
call npx prisma migrate deploy
if errorlevel 1 (
    echo ERROR: Database migration failed.
    pause
    exit /b 1
)
echo Done.
echo.

echo [3/4] Building frontend...
call npm run build:prod
if errorlevel 1 (
    echo ERROR: Frontend build failed.
    pause
    exit /b 1
)
echo Done.
echo.

echo [4/4] Creating desktop shortcut...
call create-shortcut.bat
echo.

echo ==========================================
echo   Installation Complete!
echo ==========================================
echo.
echo You can now:
echo   1. Double-click "Ledgerhound" on your desktop
echo   2. Or run start-ledgerhound.bat from this folder
echo.
echo The app will open at http://localhost:3001
echo.
pause
