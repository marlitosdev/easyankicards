@echo off
chcp 65001 >nul
title EasyAnkiCards - Compilar .exe
rem Trabalha sempre a partir da RAIZ do projeto (pasta acima de scripts\)
cd /d "%~dp0.."

echo ============================================================
echo  EasyAnkiCards para Anki - Compilacao do .exe
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
python -m pip install customtkinter genanki pyinstaller
if errorlevel 1 (
    echo [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo.
echo [2/4] Compilando (pode levar alguns minutos)...
rem --distpath release   : o .exe final vai para a pasta release\
rem --workpath/--specpath: temporarios concentrados em .build_tmp\
python -m PyInstaller --noconfirm --onefile --windowed ^
    --name "EasyAnkiCards" ^
    --collect-all customtkinter ^
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
echo Nenhuma outra pasta foi deixada para tras.
echo Para distribuir: envie apenas esse .exe (ou anexe-o em um
echo Release do GitHub - o codigo-fonte fica no repositorio).
echo.
pause
