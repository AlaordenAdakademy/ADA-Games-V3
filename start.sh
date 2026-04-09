#!/bin/bash

# ADAGAMES V4.5 Startup Script for Linux/Unix/macOS

# Check if .venv exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Virtual environment (.venv) not found. Please create it first."
    exit 1
fi

# Set default environment variables if not set
export HOST=${HOST:-"0.0.0.0"}
export PORT=${PORT:-8000"}

echo "###########################################################"
echo "#                                                         #"
echo "#          ADAGAMES V4.5 - MOTOR DE CONTROL               #"
echo "#                                                         #"
echo "###########################################################"
echo
echo "Iniciando servidor en http://$HOST:$PORT..."
echo

# Run with gunicorn in production if available, else uvicorn
if command -v gunicorn &> /dev/null; then
    # Gunicorn is better for production on Linux
    gunicorn -w 4 -k uvicorn.workers.UvicornWorker backend.main:app --bind $HOST:$PORT
else
    python backend/main.py
fi
