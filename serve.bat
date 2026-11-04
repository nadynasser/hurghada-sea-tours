@echo off
title Hurghada Sea Tours - Local Web Server
echo Starting local web server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
