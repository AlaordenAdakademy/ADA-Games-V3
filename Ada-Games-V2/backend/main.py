from fastapi import FastAPI, HTTPException, File, UploadFile, Form
import shutil
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import socket

def get_local_ip():
    try:
        # Crea un socket temporal para detectar la IP local
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Adagames API v2")

# Allow CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "data.json"
USERS_FILE = "users.json"

def generate_initial_tracks():
    structure = {}
    for r in range(1, 6):
        structure[str(r)] = {}
        for p in range(1, 6):
            structure[str(r)][str(p)] = {"sequence": [], "obstacles": []}
    return structure

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"teams": [], "tracks": generate_initial_tracks()}
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    
    # Migración: Asegurar que todos los equipos tengan categoría
    changed = False
    for team in data.get("teams", []):
        if "category" not in team:
            team["category"] = "quest"
            changed = True
    
    if changed:
        save_data(data)
        
    return data

def load_users():
    if not os.path.exists(USERS_FILE):
        # Default users if file missing
        return [
            {"id": "admin", "name": "Administrador Central", "role": "admin", "password": "ada123admin"},
            {"id": "juez1", "name": "Juez Principal - Pista A", "role": "judge", "password": "juez1"}
        ]
    with open(USERS_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# API Routes
@app.get("/api/data")
def get_all_data(category: Optional[str] = None):
    data = load_data()
    if category:
        # Filtrar equipos por categoría
        data["teams"] = [t for t in data["teams"] if t.get("category") == category]
    return data

@app.get("/api/users")
def get_users():
    return load_users()

@app.post("/api/teams")
def update_teams(teams: List[Dict[str, Any]], category: Optional[str] = None):
    data = load_data()
    if category:
        # Mantener los equipos de otras categorías y solo actualizar la actual
        other_teams = [t for t in data["teams"] if t.get("category") != category]
        data["teams"] = other_teams + teams
    else:
        # Si no hay categoría (admin global o legacy), reemplaza todo
        data["teams"] = teams
    save_data(data)
    return {"status": "ok"}

@app.post("/api/tracks")
def update_tracks(tracks: Dict[str, Any]):
    data = load_data()
    data["tracks"] = tracks
    save_data(data)
    return {"status": "ok"}

@app.post("/api/upload_map")
async def upload_map(ronda: int = Form(...), pista: int = Form(...), file: UploadFile = File(...)):
    frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
    maps_dir = os.path.join(frontend_path, "maps")
    os.makedirs(maps_dir, exist_ok=True)
    
    extension = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"mapa_ronda{ronda}_pista{pista}.{extension}"
    file_path = os.path.join(maps_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Return cache-busted URL so browser updates it instantly
    import time
    return {"url": f"/maps/{filename}?t={int(time.time())}"}

# Serve frontend files at root
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    local_ip = get_local_ip()
    print(f"\n{'#'*50}")
    print(f"ADAGAMES v4.5 INICIADO")
    print(f"ACCESO LOCAL: http://localhost:8001")
    print(f"ACCESO WIFI:  http://{local_ip}:8001")
    print(f"{'#'*50}\n")
    uvicorn.run(app, host="0.0.0.0", port=8001)
