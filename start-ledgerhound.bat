@echo off
title Ledgerhound
cd /d "%~dp0"

echo ==============================
echo   Ledgerhound - Starting...
echo ==============================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
)

REM Build frontend if dist folder doesn't exist
if not exist "dist\" (
    echo Building frontend for first time...
    call npm run build:prod
    if errorlevel 1 (
        echo ERROR: Frontend build failed.
        pause
        exit /b 1
    )
    echo.
)

REM Run database migrations
echo Running database migrations...
call npx prisma migrate deploy
if errorlevel 1 (
    echo WARNING: Migration failed. Continuing anyway...
)
echo.

REM Open browser after a short delay (in background)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001"

echo Starting Ledgerhound server on http://localhost:3001
echo Press Ctrl+C to stop.
echo.

REM Start the API server (blocks until stopped)
call npx tsx src-server/api.ts
