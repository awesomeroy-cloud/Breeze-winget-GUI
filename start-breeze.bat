@echo off
title Breeze Winget GUI Launcher
cd /d "%~dp0"
echo ========================================================
echo   🍃 Starting Breeze (Windows Package Manager GUI)...
echo ========================================================
npm run tauri dev
pause
