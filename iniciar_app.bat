@echo off
chcp 65001 >nul
cd /d "%~dp0"
python src\easyankicards\app.py
if errorlevel 1 (
    echo.
    echo [ERRO/ERROR] Instale as dependencias:  pip install -r requirements.txt
    pause
)
