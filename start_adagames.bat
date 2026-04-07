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

:: Detectar IP Local (PowerShell es mas fiable que ipconfig)
for /f "tokens=*" %%a in ('powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -ExpandProperty IPAddress | Select-Object -First 1"') do set LOCAL_IP=%%a

if "%LOCAL_IP%"=="" (
    for /f "tokens=*" %%a in ('powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike '*Loopback*' } | Select-Object -ExpandProperty IPAddress | Select-Object -First 1"') do set LOCAL_IP=%%a
)

echo [1/3] Verificando dependencias en Python...
pip install -q -r backend/requirements.txt

echo.
echo [2/3] CONFIGURACION DE RED LOCAL:
echo      ======================================================
echo      PARA EVALUADORES (WiFi/LAN):
echo      URL: http://%LOCAL_IP%:8000
echo      ======================================================
echo.
echo [3/3] INICIANDO MOTOR ADAGAMES...
echo.
echo NOTA: Si otros dispositivos no pueden entrar, asegurese de
echo       "Permitir el acceso" en la alerta del Firewall de Windows.
echo.

python backend/main.py
pause
