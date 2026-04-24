from fastapi import FastAPI, HTTPException, File, UploadFile, Form
import shutil
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
import os
import socket
import tempfile
import threading
from datetime import datetime
import time

# Lock global para evitar escrituras concurrentes en data.json
_data_lock = threading.Lock()

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

def generate_initial_timer():
    return {"timer": 1800, "timerActive": False, "updatedAt": time.time()}

def generate_initial_timers():
    return {
        "quest": generate_initial_timer(),
        "line_follower": generate_initial_timer()
    }

def get_calculated_timer(timer_data):
    """Calcula el tiempo restante real basado en el momento en que se activó."""
    if not timer_data.get("timerActive", False):
        return timer_data
    
    updated_at = timer_data.get("updatedAt", time.time())
    original_timer = timer_data.get("timer", 0)
    elapsed = int(time.time() - updated_at)
    
    current_timer = max(0, original_timer - elapsed)
    active = timer_data["timerActive"]
    
    if current_timer <= 0:
        active = False
        
    return {"timer": current_timer, "timerActive": active, "updatedAt": updated_at}

def load_data():
    with _data_lock:
        if not os.path.exists(DATA_FILE):
            return {"teams": [], "tracks": generate_initial_tracks(), "timers": generate_initial_timers()}
        with open(DATA_FILE, "r", encoding='utf-8') as f:
            data = json.load(f)
    
    # Migración: Asegurar campos necesarios
    changed = False
    # Migración: Convertir timer antiguo a nuevo sistema dual
    if "timers" not in data:
        if "timer" in data:
            old_timer = data.pop("timer")
            if "updatedAt" not in old_timer:
                old_timer["updatedAt"] = time.time()
            data["timers"] = {
                "quest": old_timer,
                "line_follower": {"timer": 1800, "timerActive": False, "updatedAt": time.time()}
            }
        else:
            data["timers"] = generate_initial_timers()
        changed = True
    else:
        for cat in ["quest", "line_follower"]:
            if cat not in data["timers"]:
                data["timers"][cat] = generate_initial_timer()
                changed = True
            elif "updatedAt" not in data["timers"][cat]:
                data["timers"][cat]["updatedAt"] = time.time()
                changed = True
    
    # Migración: Asegurar que todos los equipos tengan categoría, rondas y tickets
    for team in data.get("teams", []):
        if "category" not in team:
            team["category"] = "quest"
            changed = True
        if "qualifiedRounds" not in team:
            team["qualifiedRounds"] = [1]
            changed = True
        if "practiceTickets" not in team:
            team["practiceTickets"] = 5
            changed = True
        if "evaluationTickets" not in team:
            team["evaluationTickets"] = {"1": 1, "2": 1, "3": 1, "4": 1, "5": 1}
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
    with open(USERS_FILE, "w", encoding='utf-8') as f:
        json.dump(users, f, indent=4, ensure_ascii=False)

def save_data(data):
    """Escritura atómica + lock: imposible de corromper por peticiones concurrentes."""
    with _data_lock:
        data_dir = os.path.dirname(os.path.abspath(DATA_FILE)) or '.'
        tmp_fd, tmp_path = tempfile.mkstemp(dir=data_dir, suffix='.tmp')
        try:
            with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            shutil.move(tmp_path, DATA_FILE)
        except Exception:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
            raise

# API Routes
@app.get("/api/data")
def get_all_data(category: Optional[str] = None):
    data = load_data()
    # Calcular tiempo real antes de enviar para todos los timers
    timers_data = data.get("timers", generate_initial_timers())
    data["timers"] = {
        "quest": get_calculated_timer(timers_data.get("quest", generate_initial_timer())),
        "line_follower": get_calculated_timer(timers_data.get("line_follower", generate_initial_timer()))
    }
    
    if category:
        # Filtrar equipos por categoría
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
        # Mantener los equipos de otras categorías y solo actualizar la actual
        other_teams = [t for t in data["teams"] if t.get("category") != category]
        data["teams"] = other_teams + teams
    else:
        # Si no hay categoría (admin global o legacy), reemplaza todo
        data["teams"] = teams
    save_data(data)
    return {"status": "ok"}

@app.post("/api/teams/bulk")
def bulk_add_teams(new_teams: List[Dict[str, Any]], category: Optional[str] = None):
    """Agrega múltiples equipos nuevos en una sola operación atómica.
    Mucho más seguro que llamar /api/teams múltiples veces seguidas."""
    data = load_data()
    for team in new_teams:
        team['id'] = str(int(time.time() * 1000)) + str(hash(team.get('school','')) % 10000)
        team['status'] = 'pending'
        team['score'] = 0
        team['history'] = []
        if category and 'category' not in team:
            team['category'] = category
    data['teams'].extend(new_teams)
    save_data(data)
    return {"status": "ok", "imported": len(new_teams)}

@app.post("/api/tracks")
def update_tracks(tracks: Dict[str, Any]):
    data = load_data()
    data["tracks"] = tracks
    save_data(data)
    return {"status": "ok"}

class ResetAuth(BaseModel):
    userId: str
    password: str

@app.post("/api/reset")
def reset_competition(auth: ResetAuth):
    users = load_users()
    admin_user = next((u for u in users if u["id"] == auth.userId and u["password"] == auth.password and u.get("role") == "admin"), None)
    if not admin_user:
        raise HTTPException(status_code=401, detail="Credenciales de administrador inválidas o insuficientes")
        
    if os.path.exists(DATA_FILE):
        backups_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
        os.makedirs(backups_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_path = os.path.join(backups_dir, f"data_backup_{timestamp}.json")
        shutil.copy2(DATA_FILE, backup_path)
        
    initial_data = {"teams": [], "tracks": generate_initial_tracks(), "timers": generate_initial_timers()}
    save_data(initial_data)
    return {"status": "ok"}

@app.post("/api/reset/scores")
def reset_scores(auth: ResetAuth):
    users = load_users()
    admin_user = next((u for u in users if u["id"] == auth.userId and u["password"] == auth.password and u.get("role") == "admin"), None)
    if not admin_user:
        raise HTTPException(status_code=401, detail="Credenciales de administrador inválidas o insuficientes")
    
    data = load_data()
    # Backup
    backups_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backups"))
    os.makedirs(backups_dir, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    backup_path = os.path.join(backups_dir, f"scores_backup_{timestamp}.json")
    save_data(data) # Ensure current is saved
    shutil.copy2(DATA_FILE, backup_path)

    # Reset only scores, history and tickets
    for team in data.get("teams", []):
        team["score"] = 0
        team["history"] = []
        team["lastTime"] = 0
        team["status"] = "inspected"
        team["practiceTickets"] = 5
        # Asegurar que las llaves sean strings para compatibilidad JSON
        team["evaluationTickets"] = { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 }
    
    save_data(data)
    return {"status": "ok"}

@app.get("/api/timer")
def get_timer():
    data = load_data()
    timers_data = data.get("timers", generate_initial_timers())
    return {
        "quest": get_calculated_timer(timers_data.get("quest", generate_initial_timer())),
        "line_follower": get_calculated_timer(timers_data.get("line_follower", generate_initial_timer()))
    }

class TimerData(BaseModel):
    timer: int
    timerActive: bool

class TimersSync(BaseModel):
    quest: Optional[TimerData] = None
    line_follower: Optional[TimerData] = None

@app.post("/api/timer")
def update_timer(sync: TimersSync):
    data = load_data()
    if "timers" not in data:
        data["timers"] = generate_initial_timers()
        
    if sync.quest is not None:
        data["timers"]["quest"] = {
            "timer": sync.quest.timer, 
            "timerActive": sync.quest.timerActive, 
            "updatedAt": time.time()
        }
    if sync.line_follower is not None:
        data["timers"]["line_follower"] = {
            "timer": sync.line_follower.timer, 
            "timerActive": sync.line_follower.timerActive, 
            "updatedAt": time.time()
        }
        
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
