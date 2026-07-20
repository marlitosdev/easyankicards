@echo off
chcp 65001 >nul
title EasyAnkiCards - Compilar .exe
rem Trabalha sempre a partir da RAIZ do projeto (pasta acima de scripts\)
cd /d "%~dp0.."

echo ============================================================
echo  EasyAnkiCards - Compilacao do .exe
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH.
    echo Instale em https://www.python.org/downloads/ marcando
    echo a opcao "Add Python to PATH".
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias...
python -m pip install --upgrade pip >nul
python -m pip install pywebview pyinstaller
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [2/4] Compilando (pode levar alguns minutos)...
rem --add-data "docs;docs" : embute a interface (a mesma da versao web)
rem --distpath release      : o .exe final vai para a pasta release\
rem --workpath/--specpath   : temporarios concentrados em .build_tmp\
python -m PyInstaller --noconfirm --onefile --windowed ^
    --name "EasyAnkiCards" ^
    --add-data "docs;docs" ^
    --distpath release ^
    --workpath .build_tmp ^
    --specpath .build_tmp ^
    src\easyankicards\app.py
if errorlevel 1 (
    echo [ERRO] Falha na compilacao. Veja as mensagens acima.
    pause
    exit /b 1
)

echo.
echo [3/4] Limpando arquivos temporarios...
rmdir /s /q .build_tmp 2>nul

echo [4/4] Pronto!
echo.
echo Executavel unico gerado em:  release\EasyAnkiCards.exe
echo Ele ja contem a interface completa (mesma da versao web) e
echo funciona sem internet. Para distribuir: envie apenas esse .exe.
echo.
pause
