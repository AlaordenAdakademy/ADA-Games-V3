#!/bin/bash
# ############################################################
# #                                                          #
# #          ADAGAMES V4.5 - ESTACION DE CONTROL            #
# #                  Script para Linux/macOS                #
# #                                                          #
# ############################################################

# Moverse al directorio donde está este script
cd "$(dirname "$0")"

echo "###########################################################"
echo "#                                                         #"
echo "#          Robot Challenge 2026 - ESTACION DE CONTROL            #"
echo "#                                                         #"
echo "###########################################################"
echo ""

# ---- Detectar IP Local ----
detect_ip() {
    # Intentar con hostname -I (Linux)
    if command -v hostname &>/dev/null; then
        IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    # Fallback: usar ip route (Linux moderno)
    if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ]; then
        IP=$(ip route get 8.8.8.8 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')
    fi
    # Fallback: usar ifconfig (macOS / Linux con net-tools)
    if [ -z "$IP" ] || [ "$IP" = "127.0.0.1" ]; then
        IP=$(ifconfig 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | head -1)
    fi
    # Último recurso
    if [ -z "$IP" ]; then
        IP="127.0.0.1"
    fi
    echo "$IP"
}

LOCAL_IP=$(detect_ip)

# ---- Verificar Python ----
echo "[1/3] Verificando dependencias en Python..."
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python3 no está instalado. Instálalo con:"
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
    echo "  Fedora/RHEL:   sudo dnf install python3 python3-pip"
    echo "  macOS:         brew install python3"
    exit 1
fi

# Instalar dependencias
pip3 install -q -r backend/requirements.txt
if [ $? -ne 0 ]; then
    echo "ADVERTENCIA: Algunas dependencias pueden no haberse instalado correctamente."
    echo "Intenta manualmente: pip3 install fastapi uvicorn[standard]"
fi

echo ""
echo "[2/3] CONFIGURACION DE RED LOCAL:"
echo "     ======================================================"
echo "     PARA EVALUADORES (WiFi/LAN):"
echo "     URL: http://${LOCAL_IP}:8001"
echo "     ======================================================"
echo ""
echo "[3/3] INICIANDO MOTOR ADAGAMES..."
echo ""
echo "  Presiona Ctrl+C para detener el servidor."
echo ""
echo "##################################################"
echo "  ADAGAMES v4.5 INICIADO"
echo "  ACCESO LOCAL: http://localhost:8001"
echo "  ACCESO WIFI:  http://${LOCAL_IP}:8001"
echo "##################################################"
echo ""

# ---- Ejecutar el servidor ----
python3 backend/main.py
