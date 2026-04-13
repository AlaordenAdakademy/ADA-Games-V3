from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import socket
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR))
DATA_FILE = DATA_DIR / "data.json"
USERS_FILE = DATA_DIR / "users.json"

# Ensure DATA_DIR exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

def get_local_ip():
    """Detect local IP for development convenience."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.1)
        # doesn't even have to be reachable
        s.connect(("10.254.254.254", 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(title="Adagames API v2")

# Health check for cloud monitoring
@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "4.5"}

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
    
    # Migraci├│n: Asegurar que todos los equipos tengan categor├¡a
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

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=4)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# API Routes
@app.get("/api/data")
def get_all_data(category: Optional[str] = None):
    data = load_data()
    if category:
        # Filtrar equipos por categor├¡a
        data["teams"] = [t for t in data["teams"] if t.get("category") == category]
    return data

@app.get("/api/users")
def get_users():
    return load_users()

@app.post("/api/users")
def save_user(user: Dict[str, Any]):
    users = load_users()
    # Check if user exists (by ID)
    for i, u in enumerate(users):
        if u["id"] == user["id"]:
            users[i] = user
            save_users(users)
            return {"status": "ok"}
    
    # New user
    users.append(user)
    save_users(users)
    return {"status": "ok"}

@app.delete("/api/users/{user_id}")
def delete_user(user_id: str):
    if user_id == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete admin user")
    
    users = load_users()
    users = [u for u in users if u["id"] != user_id]
    save_users(users)
    return {"status": "ok"}

@app.post("/api/teams")
def update_teams(teams: List[Dict[str, Any]], category: Optional[str] = None):
    data = load_data()
    if category:
        # Mantener los equipos de otras categor├¡as y solo actualizar la actual
        other_teams = [t for t in data["teams"] if t.get("category") != category]
        data["teams"] = other_teams + teams
    else:
        # Si no hay categor├¡a (admin global o legacy), reemplaza todo
        data["teams"] = teams
    save_data(data)
    return {"status": "ok"}

@app.post("/api/tracks")
def update_tracks(tracks: Dict[str, Any]):
    data = load_data()
    data["tracks"] = tracks
    save_data(data)
    return {"status": "ok"}

# Serve frontend files at root
frontend_path = BASE_DIR / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="frontend")
else:
    print(f"Warning: Frontend path not found at {frontend_path}", file=sys.stderr)

if __name__ == "__main__":
    import uvicorn
    
    # Only print local access info if we aren't explicitly told we're in "production"
    # or if we are binding to localhost/0.0.0.0
    if HOST in ["0.0.0.0", "127.0.0.1", "localhost"]:
        local_ip = get_local_ip()
        print(f"\n{'#'*50}")
        print(f"ADAGAMES v4.5 INICIADO")
        print(f"MODO: {'Desarrollo' if os.getenv('DEBUG') else 'Producci├│n'}")
        print(f"ACCESO LOCAL: http://localhost:{PORT}")
        if HOST == "0.0.0.0":
            print(f"ACCESO RED:   http://{local_ip}:{PORT}")
        print(f"{'#'*50}\n")
    
    uvicorn.run("main:app", host=HOST, port=PORT, reload=bool(os.getenv("DEBUG")))
