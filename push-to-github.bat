@echo off
title Push Hurghada Sea Tours to GitHub
color 0B
echo ============================================================
echo   Hurghada Sea Tours - GitHub Push
echo ============================================================
echo.
echo Target Repository: https://github.com/nadynasser/hurghada-sea-tours.git
echo.
echo Connecting to GitHub and pushing main branch...
echo.
cd /d "%~dp0"
git push -u origin main
echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo ============================================================
    echo   SUCCESS: Project uploaded to GitHub successfully!
    echo ============================================================
) else (
    color 0C
    echo ============================================================
    echo   NOTICE: If authentication is required, you can sign in
    echo   via browser or use a GitHub Personal Access Token.
    echo ============================================================
)
echo.
pause
