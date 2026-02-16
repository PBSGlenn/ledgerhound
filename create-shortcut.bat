@echo off
REM Creates a desktop shortcut for Ledgerhound
cd /d "%~dp0"

REM Detect actual Desktop path (handles OneDrive redirection)
for /f "delims=" %%D in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESKTOP=%%D"

set "SHORTCUT=%DESKTOP%\Ledgerhound.lnk"
set "TARGET=%~dp0start-ledgerhound.bat"
set "WORKDIR=%~dp0"
set "ICON=%SystemRoot%\System32\shell32.dll,15"

echo Creating desktop shortcut...
echo Desktop path: %DESKTOP%

REM Use PowerShell to create a .lnk shortcut
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%WORKDIR%'; $s.IconLocation = '%ICON%'; $s.Description = 'Ledgerhound - Personal and Business Accounting'; $s.WindowStyle = 7; $s.Save()"

if exist "%SHORTCUT%" (
    echo.
    echo Shortcut created: %SHORTCUT%
    echo You can now launch Ledgerhound from your desktop!
) else (
    echo.
    echo ERROR: Failed to create shortcut.
)
echo.
pause
