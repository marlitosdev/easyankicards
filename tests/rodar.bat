@echo off
chcp 65001 >nul
cd /d "%~dp0.."
node tests\rodar.js %*
echo.
pause
