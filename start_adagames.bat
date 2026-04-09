@echo off
setlocal enabledelayedexpansion
title ADAGAMES V4.5 SERVER
color 0b

echo ###########################################################
echo #                                                         #
echo #          ADAGAMES V4.5 - ESTACION DE CONTROL            #
echo #                                                         #
echo ###########################################################
echo.

REM Check for venv directory
if not exist ".venv" (
    echo [ERROR] No se encontro el entorno virtual venv.
    echo Por favor, ejecute: python -m venv .venv
    pause
    exit /b
)

echo [1/2] Verificando dependencias...
call ".venv\Scripts\activate.bat"
python -m pip install -q -r backend/requirements.txt

echo.
echo [2/2] INICIANDO MOTOR ADAGAMES...
echo.

REM Run the application
python backend/main.py
pause
