@echo off
echo ============================================================
echo   Hurghada Sea Tours - Launcher
echo ============================================================
echo   [1] Open Customer Website (index.html)
echo   [2] Open Operations Dashboard (dashboard.html)
echo   [3] Open Both Website & Dashboard
echo ============================================================
set /p choice="Select option [1-3] (Press Enter for 1): "

if "%choice%"=="2" (
    start "" "%~dp0dashboard.html"
) else if "%choice%"=="3" (
    start "" "%~dp0index.html"
    start "" "%~dp0dashboard.html"
) else (
    start "" "%~dp0index.html"
)
