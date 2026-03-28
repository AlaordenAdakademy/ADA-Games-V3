const { useState, useEffect, useMemo } = React;

// --- CONFIGURACIÓN DE ICONOS ---
// Componente para manejar iconos de Lucide vía CDN
const Icon = ({ name, className = "w-5 h-5", ...props }) => {
    useEffect(() => {
        if (window.lucide) {
            try { lucide.createIcons(); } catch (e) { }
        }
    }, [name]);
    return <i data-lucide={name || 'help-circle'} className={className} {...props}></i>;
};

// --- CONSTANTES ---
const ROWS = [6, 5, 4, 3, 2, 1];
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const API_BASE = "/api";

// --- COMPONENTE PRINCIPAL ---
function App() {
  const [activeTab, setActiveTab] = useState('registro');
  const [teams, setTeams] = useState([]);
  const [tracks, setTracks] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('ada_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Estados para Competencia (v3.2)
  const [competitionMode, setCompetitionMode] = useState(false);
  const [timer, setTimer] = useState(() => {
    const saved = localStorage.getItem('ada_timer');
    return saved ? parseInt(saved) : 1800; // 30 min por defecto
  });
  const [timerActive, setTimerActive] = useState(() => {
    const saved = localStorage.getItem('ada_timer_active');
    return saved === 'true';
  });
  
  // Estados para UI
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // 1. Cargar datos iniciales desde el servidor y sincronización periódica
  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = currentUser ? `${API_BASE}/data?category=${currentUser.category}` : `${API_BASE}/data`;
        const res = await fetch(url);
        const data = await res.json();
        setTeams(data.teams || []);
        setTracks(data.tracks || {});
        
        // Sincronizar localmente para otras pestañas
        localStorage.setItem('ada_teams', JSON.stringify(data.teams));
        localStorage.setItem('ada_tracks', JSON.stringify(data.tracks));
        setLoading(false);
      } catch (err) {
        console.error("Error cargando datos:", err);
        setToastMessage("Error conectando con el servidor");
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Cargar usuarios
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/users`);
        const data = await res.json();
        setUsers(data || []);
      } catch (err) {
        console.error("Error cargando usuarios:", err);
      }
    };
    fetchUsers();
  }, []);

  // 2. Sincronización entre Pestañas (Pilar 3)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'ada_teams') {
        const newTeams = JSON.parse(e.newValue) || [];
        if (JSON.stringify(newTeams) !== JSON.stringify(teams)) setTeams(newTeams);
      }
      if (e.key === 'ada_tracks') {
        const newTracks = JSON.parse(e.newValue);
        if (JSON.stringify(newTracks) !== JSON.stringify(tracks)) setTracks(newTracks);
      }
      if (e.key === 'ada_user') {
        setCurrentUser(e.newValue ? JSON.parse(e.newValue) : null);
      }
      if (e.key === 'ada_timer') {
        setTimer(parseInt(e.newValue));
      }
      if (e.key === 'ada_timer_active') {
        setTimerActive(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [teams, tracks]);

  // --- MÉTODOS DE API Y LOCAL ---

  const logout = () => {
    localStorage.removeItem('ada_user');
    setCurrentUser(null);
    setActiveTab('registro'); // Reset tab on logout
  };

  const switchCategory = (newCat) => {
    const updatedUser = { ...currentUser, category: newCat };
    localStorage.setItem('ada_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setLoading(true); // Trigger re-fetch
    showToast(`Cambiado a ${newCat === 'quest' ? 'Robotics Quest' : 'Seguidor de Línea'}`);
  };

  // Lógica del Cronómetro
  useEffect(() => {
    let interval = null;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
            const next = prev - 1;
            if (next % 5 === 0) localStorage.setItem('ada_timer', next.toString()); // Sincronizar cada 5s
            return next;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  const toggleTimer = () => {
    const nextState = !timerActive;
    setTimerActive(nextState);
    localStorage.setItem('ada_timer_active', nextState.toString());
  };

  const resetTimer = () => {
    setTimer(1800);
    setTimerActive(false);
    localStorage.setItem('ada_timer', '1800');
    localStorage.setItem('ada_timer_active', 'false');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const postTeams = (newTeams) => {
    setTeams(newTeams);
    localStorage.setItem('ada_teams', JSON.stringify(newTeams));
    
    const url = currentUser?.category ? `${API_BASE}/teams?category=${currentUser.category}` : `${API_BASE}/teams`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTeams)
    });
  };

  const postTracks = (newTracks) => {
    setTracks(newTracks);
    localStorage.setItem('ada_tracks', JSON.stringify(newTracks));
    
    fetch(`${API_BASE}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTracks)
    });
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const addTeam = (teamData) => {
    const newId = Date.now().toString();
    const updated = [...teams, { id: newId, ...teamData, status: 'pending', score: 0, history: [], category: currentUser.category }];
    postTeams(updated);
    showToast('Equipo registrado con éxito');
  };

  const updateTeamStatus = (teamId, status) => {
    const updated = teams.map(t => t.id === teamId ? { ...t, status } : t);
    postTeams(updated);
  };

  const disqualifyTeam = (teamId, reason) => {
    setConfirmDialog({
      message: `¿Estás seguro de descalificar al equipo por: ${reason}?`,
      onConfirm: () => {
        const updated = teams.map(t => t.id === teamId ? { ...t, status: 'disqualified', disqualifiedReason: reason, judgeId: currentUser.id, judgeName: currentUser.name } : t);
        postTeams(updated);
        setConfirmDialog(null);
        showToast('Equipo descalificado');
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const addScore = (teamId, ronda, pista, points) => {
    const updated = teams.map(t => {
      if (t.id === teamId) {
        return {
          ...t,
          score: t.score + points,
          history: [...t.history, { 
            ronda, 
            pista, 
            points, 
            date: new Date().toLocaleTimeString(),
            judgeId: currentUser.id,
            judgeName: currentUser.name
          }]
        };
      }
      return t;
    });
    postTeams(updated);
    showToast('Puntaje guardado exitosamente');
  };

  const updateTrackData = (ronda, pista, data) => {
    const updated = {
      ...tracks,
      [ronda]: {
        ...tracks[ronda],
        [pista]: { ...tracks[ronda][pista], ...data }
      }
    };
    postTracks(updated);
  };

  const [selectedTeamHistory, setSelectedTeamHistory] = useState(null);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="animate-pulse flex flex-col items-center">
        <Icon name="trophy" className="w-12 h-12 text-blue-400 mb-4" />
        <h2 className="font-black text-2xl uppercase tracking-widest">Cargando Adagames...</h2>
      </div>
    </div>
  );

  if (!currentUser) return <Login onLogin={login} users={users} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-800 relative">
      <HistorialModal teams={teams} selectedId={selectedTeamHistory} onClose={() => setSelectedTeamHistory(null)} />
      {competitionMode && <CompetitionOverlay teams={teams} timer={timer} timerActive={timerActive} toggleTimer={toggleTimer} resetTimer={resetTimer} formatTime={formatTime} onExit={() => setCompetitionMode(false)} category={currentUser.category} />}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 animate-fadeIn">
          <Icon name="check-circle" className="w-5 h-5 text-green-400" />
          {toastMessage}
        </div>
      )}

      {/* Modal de Confirmación */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <Icon name="shield-alert" className="w-8 h-8" />
              <h3 className="font-black text-xl">Atención</h3>
            </div>
            <p className="text-slate-600 font-medium mb-8">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={confirmDialog.onCancel} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors">Cancelar</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-lg shadow-red-600/30 transition-colors">Proceder</button>
            </div>
          </div>
        </div>
      )}

      <nav className="bg-blue-950 text-white md:w-64 flex-shrink-0 flex md:flex-col shadow-2xl z-20 sticky top-0 md:h-screen">
        <div className="p-5 border-b border-blue-900 bg-blue-950">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
              <Icon name="trophy" className="text-white w-6 h-6" />
            </div>
            <h1 className="font-black text-xl tracking-tighter leading-tight">ADAGAMES<br/><span className="text-[10px] text-blue-400 font-bold tracking-widest uppercase">{currentUser.category === 'line_follower' ? 'Line Follower' : 'Robotics Quest'}</span></h1>
          </div>
          <div className="bg-blue-900/50 p-3 rounded-xl">
            <div className="flex items-center gap-2 overflow-hidden mb-2">
               <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0">
                  <Icon name="users" className="w-4 h-4 text-white" />
               </div>
               <div className="truncate">
                  <p className="text-[10px] font-bold text-blue-300 uppercase leading-none">{currentUser.role === 'admin' ? 'Administrador' : 'Juez'}</p>
                  <p className="text-xs font-black truncate">{currentUser.name}</p>
               </div>
            </div>
            {currentUser.role === 'admin' && (
                <div className="mt-3 pt-3 border-t border-blue-800/50">
                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-2 text-center">Cambiar Categoría</p>
                    <div className="flex gap-1 p-1 bg-blue-950 rounded-xl border border-blue-800">
                        <button 
                            onClick={() => switchCategory('quest')}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentUser.category === 'quest' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-300 hover:bg-black/20'}`}
                        >
                            QUEST
                        </button>
                        <button 
                            onClick={() => switchCategory('line_follower')}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-black transition-all ${currentUser.category === 'line_follower' ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-300 hover:bg-black/20'}`}
                        >
                            LINE
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-1 md:flex-col overflow-x-auto md:overflow-y-auto">
          {currentUser.role === 'admin' && (
            <>
              <NavButton active={activeTab === 'registro'} onClick={() => setActiveTab('registro')} icon={<Icon name="users" />} label="Registro" />
              <NavButton active={activeTab === 'inspeccion'} onClick={() => setActiveTab('inspeccion')} icon={<Icon name="clipboard-check" />} label="Inspección" />
              {currentUser.category === 'quest' && (
                <NavButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Icon name="settings" />} label="Config. Pistas" />
              )}
            </>
          )}
          <NavButton active={activeTab === 'evaluacion'} onClick={() => setActiveTab('evaluacion')} icon={<Icon name="play-circle" />} label="Evaluación" />
          <NavButton active={activeTab === 'resultados'} onClick={() => setActiveTab('resultados')} icon={<Icon name="trophy" />} label="Resultados" />
        </div>

        {/* Sección Inferior de la Sidebar */}
        <div className="p-4 border-t border-blue-900 space-y-3">
            {currentUser.role === 'admin' && (
                <button 
                    onClick={() => setCompetitionMode(true)}
                    className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20"
                >
                    <Icon name="monitor" className="w-4 h-4" /> Lanzar TV Ranking
                </button>
            )}
            
            <button 
                onClick={logout} 
                className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/20 group"
            >
                <Icon name="log-out" className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>
            </button>
        </div>

        {/* Indicador de conexión */}
        <div className="p-4 border-t border-blue-900 hidden md:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
          <span className="text-[10px] font-bold text-green-300 uppercase tracking-widest">Sincronizado</span>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
        {activeTab === 'registro' && currentUser.role === 'admin' && <RegistroTab addTeam={addTeam} />}
        {activeTab === 'inspeccion' && currentUser.role === 'admin' && <InspeccionTab teams={teams} updateTeamStatus={updateTeamStatus} disqualifyTeam={disqualifyTeam} />}
        {activeTab === 'config' && currentUser.role === 'admin' && <ConfigTab tracks={tracks} updateTrackData={updateTrackData} />}
        {activeTab === 'evaluacion' && <EvaluacionTab teams={teams} tracks={tracks} addScore={addScore} currentUser={currentUser} disqualifyTeam={disqualifyTeam} postTeams={postTeams} showToast={showToast} />}
        {activeTab === 'resultados' && <ResultadosTab teams={teams} currentUser={currentUser} onShowHistory={setSelectedTeamHistory} />}
      </main>

    </div>
  );
}

function Login({ onLogin, users }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [category, setCategory] = useState('quest');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const user = users.find(u => u.id === userId && u.password === password);
    if (user) {
      onLogin({ ...user, category });
    } else {
      setError('Credenciales incorrectas');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-fadeIn border border-slate-700">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-10 text-center text-white">
          <div className="bg-white/20 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 backdrop-blur-md shadow-inner border border-white/30">
            <Icon name="trophy" className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-tighter italic">Adagames v4.0</h2>
          <p className="text-blue-100 font-bold mt-2 uppercase text-[10px] tracking-widest leading-none">Plataforma de Competencia de Robótica</p>
        </div>
        <form onSubmit={handleLogin} className="p-8 space-y-4">
          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Categoría de Competencia</label>
            <div className="relative">
                <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-slate-800 appearance-none cursor-pointer"
                >
                    <option value="quest">Robotics Quest (Mapa de Puntajes)</option>
                    <option value="line_follower">Seguidor de Línea (Velocidad/Porcentaje)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Icon name="chevron-right" className="w-5 h-5 rotate-90" />
                </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Usuario / Rol</label>
            <div className="relative">
                <select 
                    value={userId} 
                    onChange={e => {setUserId(e.target.value); setError('');}}
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-slate-800 appearance-none"
                    required
                >
                    <option value="">-- Escoge tu perfil --</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role === 'admin' ? 'Admin' : 'Juez'})</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Icon name="users" className="w-5 h-5" />
                </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Contraseña</label>
            <div className="relative">
                <input 
                    type="password"
                    value={password}
                    onChange={e => {setPassword(e.target.value); setError('');}}
                    placeholder="••••••••"
                    className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-slate-800 pr-12"
                    required
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <Icon name="lock" className="w-5 h-5" />
                </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
                <Icon name="alert-triangle" className="w-4 h-4" />
                {error}
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 text-lg uppercase tracking-widest mt-4 group"
          >
            Acceder al Sistema
            <Icon name="play-circle" className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}

function HistorialModal({ teams, selectedId, onClose }) {
    if (!selectedId) return null;
    const team = teams.find(t => t.id === selectedId);
    if (!team) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl">
                <div className="bg-slate-50 p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-1">Auditoría de Desempeño</p>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{team.school}</h3>
                    </div>
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 p-4 rounded-2xl transition-all">
                        <Icon name="x-circle" className="text-slate-600" />
                    </button>
                </div>
                <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar">
                    {team.history.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                             <Icon name="clipboard-check" className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                             <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Sin evaluaciones registradas</p>
                        </div>
                    ) : (
                        team.history.map((h, i) => (
                            <div key={i} className="flex items-center gap-4 bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl flex-shrink-0">
                                    {h.points}
                                </div>
                                <div className="flex-1">
                                    <p className="font-black text-slate-800 uppercase tracking-tighter">Pista {h.pista} - {h.ronda === 5 ? 'Gran Final' : `Ronda ${h.ronda}`}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                                        <Icon name="users" className="w-3 h-3" /> {h.judgeName || 'Juez Desconocido'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-blue-600 uppercase tracking-widest">{h.date}</p>
                                    <p className="text-[10px] font-bold text-slate-300 uppercase mt-1">Sincronizado</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex-1 md:flex-none flex flex-col md:flex-row items-center gap-3 p-4 transition-all duration-200 ${
      active ? 'bg-blue-600 text-white shadow-lg' : 'text-blue-300/50 hover:bg-blue-900 hover:text-white'
    }`}>
      <span className="w-5 h-5">{icon}</span>
      <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider whitespace-nowrap">{label}</span>
    </button>
  );
}

// --- TABLAS Y COMPONENTES AUXILIARES ---

function ConfigTab({ tracks, updateTrackData }) {
  const [selRonda, setSelRonda] = useState(1);
  const [selPista, setSelPista] = useState(1);
  const [mode, setMode] = useState('sequence');
  
  const currentTrack = (tracks[selRonda] && tracks[selRonda][selPista]) 
                      ? tracks[selRonda][selPista] 
                      : { sequence: [], obstacles: [] };

  const toggleCell = (id) => {
    if (mode === 'sequence') {
      const idx = currentTrack.sequence.indexOf(id);
      if (idx > -1) {
        updateTrackData(selRonda, selPista, { sequence: currentTrack.sequence.filter(c => c !== id) });
      } else {
        updateTrackData(selRonda, selPista, { 
          sequence: [...currentTrack.sequence, id],
          obstacles: currentTrack.obstacles.filter(c => c !== id)
        });
      }
    } else {
      const isObs = currentTrack.obstacles.includes(id);
      updateTrackData(selRonda, selPista, { 
        obstacles: isObs ? currentTrack.obstacles.filter(c => c !== id) : [...currentTrack.obstacles, id],
        sequence: currentTrack.sequence.filter(c => c !== id)
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div className="space-y-4 w-full lg:w-auto">
            <h2 className="text-2xl font-black text-blue-900 tracking-tight uppercase">Configurador de Mapas</h2>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} onClick={() => setSelRonda(r)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selRonda === r ? 'bg-blue-600 text-white shadow-blue-500/40 shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {r === 5 ? 'GRAN FINAL' : `RONDA ${r}`}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map(p => (
                <button key={p} onClick={() => setSelPista(p)} className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${selPista === p ? 'bg-blue-400 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  PISTA {p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-full lg:w-auto">
            <button onClick={() => setMode('sequence')} className={`flex-1 lg:flex-none px-6 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mode === 'sequence' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
              <div className="w-3 h-3 rounded-full bg-blue-600" /> RUTA (1 PT)
            </button>
            <button onClick={() => setMode('obstacle')} className={`flex-1 lg:flex-none px-6 py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${mode === 'obstacle' ? 'bg-white text-red-600 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Icon name="x-circle" className="w-3 h-3 text-red-600" /> OBSTÁCULO
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3 flex flex-col items-center">
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
              <div className="inline-block min-w-[700px] border-[8px] border-blue-600 rounded-2xl bg-white shadow-2xl overflow-hidden mx-auto">
                <div className="grid grid-cols-11 bg-blue-600 text-white font-black text-[12px]">
                  <div className="p-3 border-r border-blue-500/50 flex items-center justify-center bg-blue-700">#</div>
                  {COLS.map(c => <div key={c} className="p-3 text-center flex items-center justify-center">{c}</div>)}
                </div>
                {ROWS.map(r => (
                  <div key={r} className="grid grid-cols-11 border-b border-blue-50 last:border-0">
                    <div className="bg-blue-600 text-white font-black text-[12px] flex items-center justify-center border-r border-blue-500/50 p-4">{r}</div>
                    {COLS.map(c => {
                      const id = `${c}${r}`;
                      const seqIdx = currentTrack.sequence.indexOf(id);
                      const isObs = currentTrack.obstacles.includes(id);
                      return (
                        <button key={id} onClick={() => toggleCell(id)} className={`aspect-square border-r border-blue-50 last:border-0 flex items-center justify-center relative hover:bg-blue-50 transition-colors ${isObs ? 'bg-red-50' : ''}`}>
                          {seqIdx > -1 && (
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shadow-lg border-2 border-blue-300 text-xs md:text-sm">
                              {seqIdx + 1}
                            </div>
                          )}
                          {isObs && (
                            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-600 flex items-center justify-center shadow-xl rounded-md transform border-2 border-red-400">
                              <Icon name="x-circle" className="text-white w-5 h-5 md:w-7 md:h-7" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 h-fit">
            <h3 className="font-black text-blue-900 text-sm mb-4 flex items-center gap-2 uppercase">
              <Icon name="star" className="text-blue-600 w-4 h-4"/> Resumen Pista {selPista}
            </h3>
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
                <p className="text-[10px] font-bold text-blue-400 mb-1 uppercase">Puntos Ruta</p>
                <p className="text-3xl font-black text-blue-600">{currentTrack.sequence.length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-red-100">
                <p className="text-[10px] font-bold text-red-400 mb-1 uppercase">Obstáculos</p>
                <p className="text-3xl font-black text-red-500">{currentTrack.obstacles.length}</p>
              </div>
              <button onClick={() => updateTrackData(selRonda, selPista, { sequence: [], obstacles: [] })} className="w-full py-4 text-red-500 text-[10px] font-black hover:bg-red-50 rounded-2xl transition-all border border-red-200 flex items-center justify-center gap-2 uppercase">
                <Icon name="trash-2" className="w-4 h-4" /> Limpiar Pista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluacionTab({ teams, tracks, addScore, currentUser, disqualifyTeam, postTeams, showToast }) {
  if (currentUser.category === 'line_follower') {
    return <LineFollowerEvaluacion teams={teams} addScore={addScore} currentUser={currentUser} disqualifyTeam={disqualifyTeam} postTeams={postTeams} showToast={showToast} />;
  }

  const [selTeam, setSelTeam] = useState('');
  const [selRonda, setSelRonda] = useState(1);
  const [selPista, setSelPista] = useState(1);
  const [progressIdx, setProgressIdx] = useState(-1);
  const [bonus, setBonus] = useState(false);
  
  const activeTeams = teams.filter(t => t.status === 'inspected');
  const track = (tracks[selRonda] && tracks[selRonda][selPista])
                ? tracks[selRonda][selPista]
                : { sequence: [], obstacles: [] };

  // Pillar 2: Reglas de negocio (Bloqueo de duplicados)
  const existingEvaluation = useMemo(() => {
    if (!selTeam) return null;
    const team = teams.find(t => t.id === selTeam);
    return team?.history.find(h => h.ronda === selRonda && h.pista === selPista);
  }, [teams, selTeam, selRonda, selPista]);

  const handleSave = () => {
    if (!selTeam || existingEvaluation) return;
    const total = (progressIdx + 1) + (bonus ? 3 : 0);
    addScore(selTeam, selRonda, selPista, total);
    setSelTeam('');
    setProgressIdx(-1);
    setBonus(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-200">
            <h2 className="text-xl font-black text-blue-900 mb-6 flex items-center gap-2 uppercase">
              <Icon name="play-circle" className="text-blue-600" /> Mesa de Juez
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Equipo en Pista</label>
                <select value={selTeam} onChange={e => {setSelTeam(e.target.value); setProgressIdx(-1);}} className="w-full p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 font-bold outline-none focus:border-blue-500 transition-all text-blue-900">
                  <option value="">-- Seleccionar Equipo --</option>
                  {activeTeams.map(t => <option key={t.id} value={t.id}>{t.school}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Ronda</label>
                  <select value={selRonda} onChange={e => {setSelRonda(parseInt(e.target.value)); setProgressIdx(-1);}} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm">
                    {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r === 5 ? 'Final' : `Ronda ${r}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Pista</label>
                  <select value={selPista} onChange={e => {setSelPista(parseInt(e.target.value)); setProgressIdx(-1);}} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm">
                    {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Pista {p}</option>)}
                  </select>
                </div>
              </div>

              {existingEvaluation && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex gap-3 items-start animate-fadeIn">
                    <Icon name="info" className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Ya evaluado</p>
                        <p className="text-xs text-orange-800 font-medium">Este equipo ya fue evaluado por <strong>{existingEvaluation.judgeName}</strong>.</p>
                    </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setBonus(!bonus)}
                  disabled={existingEvaluation}
                  className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${bonus ? 'bg-yellow-400 border-yellow-300 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'} ${existingEvaluation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon name="star" className={bonus ? 'fill-white' : ''} /> BONUS (+3 PTS)
                </button>
              </div>
              <div className="bg-blue-600 rounded-3xl p-6 text-center shadow-2xl shadow-blue-600/30">
                <p className="text-blue-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total a Sumar</p>
                <div className="text-7xl font-black text-white">
                  {existingEvaluation ? existingEvaluation.points : ((progressIdx + 1) + (bonus ? 3 : 0))}
                </div>
              </div>
              <button 
                onClick={handleSave}
                disabled={!selTeam || progressIdx === -1 || existingEvaluation}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black py-5 rounded-2xl shadow-lg transition-all uppercase tracking-widest"
              >
                {existingEvaluation ? 'Registrado' : 'Guardar Resultado'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 bg-white p-4 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-200 flex flex-col items-center relative overflow-hidden">
          {existingEvaluation && <div className="absolute inset-0 z-20 bg-slate-900/5 backdrop-blur-[1px] flex items-center justify-center">
             <div className="bg-white/90 px-8 py-4 rounded-full shadow-2xl border border-white font-black text-blue-900 uppercase tracking-widest text-sm flex items-center gap-3">
                <Icon name="lock" className="w-4 h-4" /> Vista de Lectura
             </div>
          </div>}
          <div className="text-center mb-8">
            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-200">Panel de Seguimiento</span>
            <h3 className="text-2xl md:text-3xl font-black text-blue-900 mt-3 uppercase italic">Pista {selPista} - {selRonda === 5 ? 'Gran Final' : `Ronda ${selRonda}`}</h3>
            {!selTeam && <p className="text-orange-500 font-bold text-sm mt-2 flex items-center justify-center gap-2"><Icon name="info" className="w-4 h-4"/> Selecciona un equipo para evaluar</p>}
          </div>
          <div className="w-full overflow-x-auto pb-4 custom-scrollbar relative">
            {!selTeam && <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px]"></div>}
            <div className="inline-block min-w-[700px] border-[10px] border-blue-600 rounded-[2rem] bg-white shadow-2xl overflow-hidden mx-auto">
              <div className="grid grid-cols-11 bg-blue-600 text-white font-black text-[11px]">
                <div className="p-3 border-r border-blue-500/50 bg-blue-700 text-center flex items-center justify-center">#</div>
                {COLS.map(c => <div key={c} className="p-3 text-center flex items-center justify-center">{c}</div>)}
              </div>
              {ROWS.map(r => (
                <div key={r} className="grid grid-cols-11 border-b border-blue-50 last:border-0">
                  <div className="bg-blue-600 text-white font-black text-[11px] flex items-center justify-center border-r border-blue-500/50 p-3">{r}</div>
                  {COLS.map(c => {
                    const id = `${c}${r}`;
                    const seqIdx = track.sequence.indexOf(id);
                    const isObs = track.obstacles.includes(id);
                    const evalIdx = existingEvaluation ? existingEvaluation.points - (existingEvaluation.points > track.sequence.length ? 3 : 0) - 1 : -1;
                    const isReached = seqIdx !== -1 && (existingEvaluation ? seqIdx <= evalIdx : seqIdx <= progressIdx);
                    
                    return (
                      <button 
                        key={id} disabled={seqIdx === -1 || !selTeam || existingEvaluation}
                        onClick={() => setProgressIdx(seqIdx === progressIdx ? seqIdx - 1 : seqIdx)}
                        className={`aspect-square border-r border-blue-50 last:border-0 flex items-center justify-center transition-all ${isReached ? 'bg-green-50' : ''}`}
                      >
                        {seqIdx > -1 && (
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full font-black flex items-center justify-center text-xs transition-all border-4 ${isReached ? 'bg-green-500 border-green-200 text-white md:scale-110 shadow-xl' : 'bg-white border-blue-500 text-blue-600 shadow-sm'}`}>
                            {seqIdx + 1}
                          </div>
                        )}
                        {isObs && (
                          <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 flex items-center justify-center shadow-xl rounded-lg transform border-2 border-red-400">
                            <Icon name="x-circle" className="text-white w-6 h-6" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistroTab({ addTeam }) {
  const [name, setName] = useState('');
  const [cap, setCap] = useState('');
  const [count, setCount] = useState(3);
  
  const handleAdd = () => {
    if(!name || !cap) return;
    addTeam({ school: name, captainName: cap, studentsCount: count });
    setName(''); setCap(''); setCount(3);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fadeIn">
      <div className="bg-white p-6 md:p-10 rounded-[3rem] shadow-2xl border border-slate-200">
        <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-8 tracking-tighter uppercase italic text-center">Registro de Equipos</h2>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Institución Educativa</label>
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 text-lg" placeholder="Nombre del Colegio o Equipo" />
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Capitán / Líder</label>
              <input value={cap} onChange={e=>setCap(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500" placeholder="Nombre completo" />
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Nº Integrantes</label>
              <input type="number" min="1" max="10" value={count} onChange={e=>setCount(e.target.value)} className="w-full p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500" />
            </div>
          </div>
          <button onClick={handleAdd} disabled={!name || !cap} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 text-lg uppercase tracking-widest mt-4">
            <Icon name="plus" className="w-6 h-6" /> Unirse a la Competencia
          </button>
        </div>
      </div>
    </div>
  );
}

function InspeccionTab({ teams, updateTeamStatus, disqualifyTeam }) {
  const pending = teams.filter(t => t.status === 'pending');
  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <h2 className="text-3xl font-black text-blue-900 mb-8 uppercase italic">Inspección de Hardware</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pending.length === 0 && (
          <div className="bg-white p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center opacity-60 col-span-2">
            <Icon name="clipboard-check" className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold text-xl uppercase tracking-tighter">No hay robots en espera</p>
          </div>
        )}
        {pending.map(t => (
          <div key={t.id} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200">
            <div className="flex justify-between items-start mb-6">
              <div><h3 className="font-black text-blue-900 text-xl">{t.school}</h3><p className="text-sm font-bold text-slate-400 mt-1 uppercase">{t.captainName}</p></div>
              <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black">ESPERA</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => updateTeamStatus(t.id, 'inspected')} className="flex-1 bg-green-500 text-white font-black py-4 rounded-xl text-[10px] uppercase">Aprobar</button>
              <button onClick={() => disqualifyTeam(t.id, 'No cumple requisitos')} className="flex-1 bg-red-50 text-red-600 font-black py-4 rounded-xl text-[10px] uppercase">Rechazar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultadosTab({ teams, currentUser, onShowHistory }) {
  const sorted = useMemo(() => {
    const list = Array.isArray(teams) ? teams : [];
    if (currentUser.category === 'line_follower') {
      return [...list].sort((a, b) => {
        // Factor 1: Porcentaje (Mayor a Menor)
        const pA = a.score || 0; 
        const pB = b.score || 0;
        if (pB !== pA) return pB - pA;
        // Factor 2: Tiempo (Menor a Mayor) - Usamos el último tiempo registrado
        const tA = a.lastTime || 999999;
        const tB = b.lastTime || 999999;
        return tA - tB;
      });
    }
    return [...teams].sort((a,b) => b.score - a.score);
  }, [teams, currentUser.category]);

  const formatResultTime = (ms) => {
    if (!ms || ms === 999999) return "--:--.--";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const msecs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      <h2 className="text-4xl font-black text-blue-900 tracking-tighter uppercase italic">Ranking {currentUser.category === 'line_follower' ? 'Seguidor de Línea' : 'Global'}</h2>
      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-6 text-[10px] uppercase w-24 text-center">Puesto</th>
              <th className="p-6 text-[10px] uppercase">Institución</th>
              <th className="p-6 text-[10px] uppercase text-center">Estado</th>
              <th className="p-6 text-[10px] uppercase text-right">
                {currentUser.category === 'line_follower' ? 'Porcentaje / Tiempo' : 'Score'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((t, i) => (
              <tr 
                key={t.id} 
                onClick={() => currentUser.role === 'admin' && onShowHistory(t.id)}
                className={`${t.status === 'disqualified' ? 'bg-red-50 opacity-50' : 'hover:bg-blue-50'} ${currentUser.role === 'admin' ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}`}
              >
                <td className="p-6 text-center font-black text-xl">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="p-6">
                    <div>
                        <p className="text-blue-900 font-black text-lg">{t.school}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.captainName}</p>
                    </div>
                </td>
                <td className="p-6 text-center">
                    <span className={`text-[9px] font-black px-4 py-1.5 rounded-full border ${t.status === 'disqualified' ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                        {t.status.toUpperCase()}
                    </span>
                </td>
                <td className="p-6 text-right">
                    <div className="flex flex-col items-end">
                        {currentUser.category === 'line_follower' ? (
                          <>
                            <span className="text-3xl font-black text-blue-600 tracking-tighter">{t.score || 0}%</span>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">{formatResultTime(t.lastTime)}</p>
                          </>
                        ) : (
                          <>
                            <span className="text-4xl font-black text-blue-600 tracking-tighter">{t.score}</span>
                            <p className="text-[8px] font-bold text-slate-300 uppercase leading-none">puntos totales</p>
                          </>
                        )}
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineFollowerEvaluacion({ teams, addScore, currentUser, disqualifyTeam, postTeams, showToast }) {
  const [selTeam, setSelTeam] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [time, setTime] = useState(120000); // 2 min en ms
  const [running, setRunning] = useState(false);
  const [penalties, setPenalties] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const activeTeams = teams.filter(t => t.status === 'inspected');

  useEffect(() => {
    let interval;
    if (running) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 120000 - elapsed);
        setTime(remaining);
        if (remaining <= 0) setRunning(false);
      }, 10);
    }
    return () => clearInterval(interval);
  }, [running, startTime]);

  const handleStart = () => {
    setStartTime(Date.now() - (120000 - time));
    setRunning(true);
  };

  const handlePause = () => setRunning(false);
  const handleReset = () => { setRunning(false); setTime(120000); setPenalties(0); setStartTime(null); };

  const formatStopwatch = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const msecs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (!selTeam) return;
    const timeTaken = 120000 - time;
    const finalTime = timeTaken + (penalties * 5000);
    const updated = teams.map(t => {
        if (t.id === selTeam) {
            return {
                ...t,
                score: percentage,
                lastTime: finalTime,
                history: [...t.history, { 
                    percentage, 
                    timeBase: timeTaken, 
                    penalties,
                    finalTime,
                    date: new Date().toLocaleTimeString(),
                    judgeId: currentUser.id,
                    judgeName: currentUser.name
                }]
            };
        }
        return t;
    });
    postTeams(updated);
    showToast('Resultado guardado');
    setSelTeam(''); setPercentage(0); handleReset();
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-blue-900 mb-8 uppercase italic flex items-center gap-3">
            <Icon name="play-circle" className="text-blue-600 w-8 h-8" /> Mesa del Juez
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Robot en Pista</label>
            <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="w-full p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 font-bold outline-none focus:border-blue-500 transition-all text-blue-900">
              <option value="">-- Seleccionar Equipo --</option>
              {activeTeams.map(t => <option key={t.id} value={t.id}>{t.school}</option>)}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Porcentaje de Recorrido</label>
                <span className="text-4xl font-black text-blue-600 tracking-tighter">{percentage}%</span>
            </div>
            <input type="range" min="0" max="100" value={percentage} onChange={e => setPercentage(parseInt(e.target.value))} className="w-full h-3 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-300">
                <span>INICIO (0%)</span><span>PROGRESO</span><span>META (100%)</span>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex gap-4">
              <button 
                onClick={() => setPenalties(p => p + 1)}
                className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-600 p-4 rounded-2xl border-2 border-orange-100 font-black text-xs flex flex-col items-center gap-1 transition-all"
              >
                  <Icon name="alert-triangle" /> Penalización (+5s)
                  <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-[10px]">{penalties}</span>
              </button>
              <button 
                onClick={() => { setPercentage(0); handleReset(); }}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-2xl border-2 border-red-100 font-black text-xs flex flex-col items-center gap-1 transition-all"
              >
                  <Icon name="ban" /> Intento Nulo
              </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl border-4 border-slate-800 text-center flex-1 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-1 bg-blue-600 group-hover:bg-blue-400 transition-colors"></div>
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Temporizador (2:00 Limite)</p>
            <div className={`text-6xl font-black font-mono tracking-widest mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-colors ${time < 10000 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatStopwatch(time)}
            </div>
            <div className="flex gap-4 justify-center">
                {!running ? (
                    <button onClick={handleStart} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-600/30 transition-all flex items-center gap-2">
                        <Icon name="play-circle" /> Iniciar
                    </button>
                ) : (
                    <button onClick={handlePause} className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-orange-500/30 transition-all flex items-center gap-2">
                        <Icon name="pause" /> Pausar
                    </button>
                )}
                <button onClick={handleReset} className="bg-slate-700 hover:bg-slate-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs transition-all">Reiniciar</button>
            </div>
        </div>

        <button 
           onClick={handleSave}
           disabled={!selTeam}
           className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-200 text-white font-black py-6 rounded-3xl shadow-2xl shadow-green-500/30 text-xl uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95"
        >
            Guardar Resultado
        </button>
      </div>
    </div>
  );
}

function CompetitionOverlay({ teams, timer, timerActive, toggleTimer, resetTimer, formatTime, onExit, category }) {
    const sorted = useMemo(() => {
        const list = Array.isArray(teams) ? teams : [];
        if (category === 'line_follower') {
          return [...list].sort((a, b) => {
            const pA = a.score || 0; 
            const pB = b.score || 0;
            if (pB !== pA) return pB - pA;
            // Desempate: Menor tiempo es mejor
            const tA = a.lastTime || 9999999;
            const tB = b.lastTime || 9999999;
            return tA - tB;
          });
        }
        return [...teams].sort((a,b) => b.score - a.score);
    }, [teams, category]);

    const formatResultTime = (ms) => {
        if (!ms || ms === 999999) return "--:--.--";
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const msecs = Math.floor((ms % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
    };
    
    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col p-8 overflow-hidden animate-fadeIn font-sans">
            <div className="flex justify-between items-start mb-12">
                <div className="flex items-center gap-6">
                    <div className="bg-blue-600 p-5 rounded-3xl shadow-2xl shadow-blue-500/40">
                        <Icon name="trophy" className="w-12 h-12 text-white" />
                    </div>
                    <div>
                        <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Ranking en Vivo</h1>
                        <p className="text-blue-400 font-bold uppercase tracking-[0.3em] text-sm mt-2">
                            {category === 'line_follower' ? 'Seguidor de Línea' : 'Robotics Quest'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-4">
                    <div className={`p-8 rounded-[2.5rem] border-4 transition-all duration-500 shadow-2xl ${timer < 300 ? 'bg-red-500/20 border-red-500 animate-pulse' : 'bg-slate-900 border-blue-500/30'}`}>
                        <p className="text-[10px] font-black text-center uppercase tracking-widest mb-1 text-slate-400">Tiempo de Competencia</p>
                        <p className="text-7xl font-black font-mono tracking-widest text-white">{formatTime(timer)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={toggleTimer} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${timerActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                            {timerActive ? 'Pausar' : 'Iniciar'}
                        </button>
                        <button onClick={resetTimer} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-[10px] uppercase">Reiniciar</button>
                        <button onClick={onExit} className="px-6 py-3 bg-slate-100/10 hover:bg-white hover:text-slate-900 rounded-xl font-black text-[10px] uppercase transition-all">Salir TV</button>
                    </div>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-1 gap-4 overflow-y-auto pr-4 custom-scrollbar">
                {sorted.map((t, i) => (
                    <div key={t.id} className={`flex items-center gap-6 p-6 rounded-3xl border-2 transition-all ${i === 0 ? 'bg-blue-600/20 border-blue-500 transform scale-[1.02] shadow-2xl' : 'bg-slate-900/50 border-slate-800'} ${t.status === 'disqualified' ? 'opacity-30' : ''}`}>
                        <div className="w-20 text-center flex flex-col items-center">
                            <span className="text-4xl font-black italic text-blue-400">#{i + 1}</span>
                            <span className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{i === 0 ? 'Líder' : ''}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-3xl font-black truncate tracking-tight">{t.school}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                                <Icon name="users" className="w-3 h-3"/> {t.captainName}
                            </p>
                        </div>
                        <div className="bg-slate-800 px-8 py-4 rounded-2xl border border-slate-700 flex flex-col items-end justify-center min-w-[150px]">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{category === 'line_follower' ? 'Porcentaje' : 'Puntaje Total'}</p>
                             <p className="text-4xl font-black text-white">{t.score || 0}{category === 'line_follower' ? '%' : ''}</p>
                             {category === 'line_follower' && (
                                <p className="text-xs font-bold text-blue-400 mt-1">{formatResultTime(t.lastTime)}</p>
                             )}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-800 flex justify-between items-center text-slate-500">
                <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Datos sincronizados en tiempo real
                </p>
                <p className="text-xs font-black italic tracking-tighter">ADAGAMES V4.0 - {category === 'line_follower' ? 'LINE FOLLOWER' : 'ROBOTICS QUEST'} ENGINE</p>
            </div>
        </div>
    );
}

// Renderizado final
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
