@echo off
echo Iniciando Adagames v2...
echo.
echo 1. Instalando/Verificando dependencias...
pip install -r backend/requirements.txt
echo.
echo 2. Iniciando Servidor...
echo El servidor estara disponible en:
echo - Local: http://localhost:8000
echo - Red: http://[TU_IP_LOCAL]:8000
echo.
python backend/main.py
pause
