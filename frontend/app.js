const { useState, useEffect, useMemo, useRef, useLayoutEffect } = React;

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

// --- HELPERS ---
const getTeamDisplayNames = (team) => {
    const teamName = team.teamName || "";
    const schoolName = team.schoolName || team.school || "";
    
    // Si solo tenemos 'school' (legacy), intentamos dividirlo
    if (!team.teamName && team.school && team.school.includes(' — ')) {
        const parts = team.school.split(' — ');
        return { team: parts[0], school: parts[1] };
    }
    
    return { team: teamName, school: schoolName };
};

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
  const [competitionMode, setCompetitionMode] = useState(null); // null | 'individual' | 'dual'
  
  const [questDuration, setQuestDuration] = useState(() => {
    const saved = localStorage.getItem('ada_quest_duration');
    return saved ? parseInt(saved) : 25; // 25 min por defecto
  });
  const [questTimer, setQuestTimer] = useState(() => {
    const saved = localStorage.getItem('ada_quest_timer');
    return saved ? parseInt(saved) : 1500;
  });
  const [questTimerActive, setQuestTimerActive] = useState(() => {
    const saved = localStorage.getItem('ada_quest_timer_active');
    return saved === 'true';
  });

  const [lineDuration, setLineDuration] = useState(() => {
    const saved = localStorage.getItem('ada_line_duration');
    return saved ? parseInt(saved) : 30; // 30 min por defecto
  });
  const [lineTimer, setLineTimer] = useState(() => {
    const saved = localStorage.getItem('ada_line_timer');
    return saved ? parseInt(saved) : 1800;
  });
  const [lineTimerActive, setLineTimerActive] = useState(() => {
    const saved = localStorage.getItem('ada_line_timer_active');
    return saved === 'true';
  });
  
  // Estados para UI
  const [showReset, setShowReset] = useState(false);
  const [showResetScores, setShowResetScores] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [rankingSuspenseMode, setRankingSuspenseMode] = useState(false);

  // 1. Cargar datos iniciales desde el servidor y sincronización periódica
  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = currentUser?.category ? `${API_BASE}/data?category=${currentUser.category}` : `${API_BASE}/data`;
        const res = await fetch(url);
        const data = await res.json();
        setTeams(data.teams || []);
        setTracks(data.tracks || {});
        
        // Sincronizar temporizadores desde el servidor
        if (data.timers) {
            // Quest
            const qServer = data.timers.quest.timer;
            const qActive = data.timers.quest.timerActive;
            if (qActive !== questTimerActive || Math.abs(qServer - questTimer) > 10) {
                setQuestTimer(qServer);
                setQuestTimerActive(qActive);
            }
            // Line
            const lServer = data.timers.line_follower.timer;
            const lActive = data.timers.line_follower.timerActive;
            if (lActive !== lineTimerActive || Math.abs(lServer - lineTimer) > 10) {
                setLineTimer(lServer);
                setLineTimerActive(lActive);
            }
        }
        
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

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/users`);
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    }
  };

  // Cargar usuarios
  useEffect(() => {
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
      if (e.key === 'ada_quest_timer') setQuestTimer(parseInt(e.newValue));
      if (e.key === 'ada_quest_timer_active') setQuestTimerActive(e.newValue === 'true');
      if (e.key === 'ada_line_timer') setLineTimer(parseInt(e.newValue));
      if (e.key === 'ada_line_timer_active') setLineTimerActive(e.newValue === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [teams, tracks]);

  // --- MÉTODOS DE API Y LOCAL ---

  const logout = () => {
    localStorage.removeItem('ada_user');
    setCurrentUser(null);
    setActiveTab('registro');
  };

  const login = (userData) => {
    localStorage.setItem('ada_user', JSON.stringify(userData));
    setCurrentUser(userData);
    setLoading(true);
  };

  const switchCategory = (newCat) => {
    const updatedUser = { ...currentUser, category: newCat };
    localStorage.setItem('ada_user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setLoading(true); // Trigger re-fetch
    showToast(`Cambiado a ${newCat === 'quest' ? 'Robotics Quest' : 'Seguidor de Línea'}`);
  };

  // Lógica del Cronómetro Quest
  useEffect(() => {
    let intervalQuest = null;
    if (questTimerActive && questTimer > 0) {
      intervalQuest = setInterval(() => {
        setQuestTimer(prev => {
            const next = prev - 1;
            if (next % 5 === 0) localStorage.setItem('ada_quest_timer', next.toString()); 
            if (next <= 0) {
                fetch(`${API_BASE}/timer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ quest: { timer: 0, timerActive: false } })
                }).catch(() => {});
                setQuestTimerActive(false);
                return 0;
            }
            return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalQuest);
  }, [questTimerActive, questTimer]);

  // Lógica del Cronómetro Line Follower
  useEffect(() => {
    let intervalLine = null;
    if (lineTimerActive && lineTimer > 0) {
      intervalLine = setInterval(() => {
        setLineTimer(prev => {
            const next = prev - 1;
            if (next % 5 === 0) localStorage.setItem('ada_line_timer', next.toString()); 
            if (next <= 0) {
                fetch(`${API_BASE}/timer`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ line_follower: { timer: 0, timerActive: false } })
                }).catch(() => {});
                setLineTimerActive(false);
                return 0;
            }
            return next;
        });
      }, 1000);
    }
    return () => clearInterval(intervalLine);
  }, [lineTimerActive, lineTimer]);

  const toggleQuestTimer = async () => {
    const nextState = !questTimerActive;
    setQuestTimerActive(nextState);
    localStorage.setItem('ada_quest_timer_active', nextState.toString());
    try {
        await fetch(`${API_BASE}/timer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quest: { timer: questTimer, timerActive: nextState } })
        });
    } catch(e) {}
  };

  const resetQuestTimer = async () => {
    const durationSeconds = questDuration * 60;
    setQuestTimer(durationSeconds);
    setQuestTimerActive(false);
    localStorage.setItem('ada_quest_timer', durationSeconds.toString());
    localStorage.setItem('ada_quest_timer_active', 'false');
    try {
        await fetch(`${API_BASE}/timer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quest: { timer: durationSeconds, timerActive: false } })
        });
    } catch(e) {}
  };

  const toggleLineTimer = async () => {
    const nextState = !lineTimerActive;
    setLineTimerActive(nextState);
    localStorage.setItem('ada_line_timer_active', nextState.toString());
    try {
        await fetch(`${API_BASE}/timer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ line_follower: { timer: lineTimer, timerActive: nextState } })
        });
    } catch(e) {}
  };

  const resetLineTimer = async () => {
    const durationSeconds = lineDuration * 60;
    setLineTimer(durationSeconds);
    setLineTimerActive(false);
    localStorage.setItem('ada_line_timer', durationSeconds.toString());
    localStorage.setItem('ada_line_timer_active', 'false');
    try {
        await fetch(`${API_BASE}/timer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ line_follower: { timer: durationSeconds, timerActive: false } })
        });
    } catch(e) {}
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
    const updated = [...teams, { 
        id: newId, 
        ...teamData, 
        status: 'pending', 
        score: 0, 
        history: [], 
        category: currentUser.category,
        qualifiedRounds: [1] 
    }];
    postTeams(updated);
    showToast('Equipo registrado con éxito');
  };

  const updateEvaluation = (teamId, historyIndex, newData) => {
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        const newHistory = [...t.history];
        newHistory[historyIndex] = { ...newHistory[historyIndex], ...newData };
        
        // Recalcular puntaje global y último tiempo para este equipo si es necesario
        // En este sistema, el score global suele ser el acumulado de puntos.
        let totalScore = newHistory.reduce((sum, h) => sum + (h.points || h.percentage || 0), 0);
        let lastTime = newHistory.length > 0 ? newHistory[newHistory.length - 1].finalTimeMs || newHistory[newHistory.length - 1].finalTime || 0 : 0;

        return { ...t, history: newHistory, score: totalScore, lastTime };
      }
      return t;
    });
    postTeams(updatedTeams);
    showToast('Evaluación actualizada');
  };

  const bulkAddTeams = async (newTeams) => {
    try {
      const category = currentUser.category;
      const res = await fetch(`${API_BASE}/teams/bulk?category=${category}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeams)
      });
      const result = await res.json();
      if (result.status === 'ok') {
        // Refrescar equipos desde el servidor para obtener el estado real
        const dataRes = await fetch(`${API_BASE}/data?category=${category}`);
        const data = await dataRes.json();
        setTeams(data.teams || []);
        localStorage.setItem('ada_teams', JSON.stringify(data.teams || []));
        showToast(`✅ ${result.imported} equipos importados correctamente`);
      } else {
        showToast('Error al importar equipos');
      }
    } catch (err) {
      console.error('Error en importación masiva:', err);
      showToast('Error de conexión al importar');
    }
  };

  const handleResetCompetition = async (password) => {
      try {
          const res = await fetch(`${API_BASE}/reset`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: currentUser.id, password })
          });
          if (res.ok) {
              localStorage.removeItem('ada_teams');
              localStorage.removeItem('ada_tracks');
              window.location.reload();
          } else {
              showToast("Error de credenciales. No autorizado.");
          }
      } catch (err) {
          showToast("Error al reiniciar competencia");
      }
  };

  const handleResetScores = (password) => {
    // Verificar contraseña localmente con los usuarios en memoria
    const adminUser = users.find(u => u.id === currentUser.id && u.password === password && u.role === 'admin');
    if (!adminUser) {
        showToast('Contraseña incorrecta. Operación cancelada.');
        return;
    }
    // Resetear tickets, puntajes e historial directamente en el estado de React
    const resetTeams = teams.map(t => ({
        ...t,
        score: 0,
        history: [],
        lastTime: 0,
        status: 'inspected',
        practiceTickets: 5,
        evaluationTickets: { "1": 1, "2": 1, "3": 1, "4": 1, "5": 1 }
    }));
    // 1. Cerrar modal inmediatamente
    setShowResetScores(false);
    // 2. Actualizar el estado local de React
    setTeams(resetTeams);
    localStorage.setItem('ada_teams', JSON.stringify(resetTeams));
    // 3. Guardar en el servidor CON filtro de categoría para NO borrar otras categorías
    const category = currentUser?.category;
    const url = category ? `${API_BASE}/teams?category=${category}` : `${API_BASE}/teams`;
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetTeams)
    }).catch(() => console.warn('Error sincronizando reset al servidor'));
    showToast('✅ Tickets y puntajes restaurados correctamente.');
  };

  const deleteEvaluation = (teamId, historyIndex) => {
      const team = teams.find(t => t.id === teamId);
      if (!team) return;
      
      const newHistory = [...team.history];
      newHistory.splice(historyIndex, 1);
      
      const newScore = newHistory.reduce((s, h) => s + (h.points || h.percentage || 0), 0);
      const newTime = newHistory.reduce((s, h) => s + (h.finalTimeMs || h.finalTime || 0), 0);

      const updated = teams.map(t => t.id === teamId ? {
          ...t,
          history: newHistory,
          score: newScore,
          lastTime: newTime > 0 ? newTime : 0
      } : t);

      postTeams(updated);
      showToast("Evaluación eliminada correctamente");
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

  const addScore = (teamId, ronda, pista, points, finalTimeMs = null, attemptType = 'evaluation') => {
    const updated = teams.map(t => {
      if (t.id === teamId) {
        // Inicializar tickets si no existen
        const practiceTickets = t.practiceTickets !== undefined ? t.practiceTickets : 5;
        const evalTickets = t.evaluationTickets || { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

        if (attemptType === 'practice') {
            return {
                ...t,
                practiceTickets: Math.max(0, practiceTickets - 1),
                history: [...t.history, { 
                    ronda, pista, points, finalTimeMs, practice: true,
                    date: new Date().toLocaleTimeString(),
                    judgeId: currentUser.id, judgeName: currentUser.name
                }]
            };
        } else {
            // Es evaluación oficial o práctica convertida a evaluación
            const newEvalTickets = { ...evalTickets };
            newEvalTickets[pista] = 0;
            
            // Si es práctica convertida, también gastar ticket de práctica
            const newPracticeTickets = attemptType === 'practice_to_eval' ? Math.max(0, practiceTickets - 1) : practiceTickets;

            return {
                ...t,
                score: (t.score || 0) + points,
                lastTime: finalTimeMs !== null ? ((t.lastTime || 0) + finalTimeMs) : t.lastTime,
                evaluationTickets: newEvalTickets,
                practiceTickets: newPracticeTickets,
                history: [...t.history, { 
                    ronda, pista, points, finalTimeMs, practice: false, convertedFromPractice: attemptType === 'practice_to_eval',
                    date: new Date().toLocaleTimeString(),
                    judgeId: currentUser.id, judgeName: currentUser.name
                }]
            };
        }
      }
      return t;
    });
    postTeams(updated);
    
    let msg = 'Evaluación OFICIAL guardada';
    if (attemptType === 'practice') msg = 'Intento de PRÁCTICA registrado';
    if (attemptType === 'practice_to_eval') msg = 'Práctica oficializada (Gasta ambos tickets)';
    showToast(msg);
  };

  const updateQualifiedRounds = (teamId, rounds) => {
    const updated = teams.map(t => t.id === teamId ? { ...t, qualifiedRounds: rounds } : t);
    postTeams(updated);
  };

  const updateManyQualifiedRounds = (updates) => {
    // updates es un objeto { [id]: newRounds }
    const updated = teams.map(t => {
        if (updates[t.id]) {
            return { ...t, qualifiedRounds: updates[t.id] };
        }
        return t;
    });
    postTeams(updated);
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

  const handleUpdateTeamBase = (teamId, newTeamName, newSchoolName) => {
    const updated = teams.map(t => t.id === teamId ? { ...t, teamName: newTeamName, schoolName: newSchoolName } : t);
    setTeams(updated);
    localStorage.setItem('ada_teams', JSON.stringify(updated));
    postTeams(updated);
    showToast('✅ Datos del equipo actualizados');
  };

  const handleDeleteTeam = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    setConfirmDialog({
        title: 'Eliminar Equipo',
        message: `¿Estás seguro de que deseas eliminar permanentemente al equipo "${team?.teamName || team?.school}" y todo su historial? Esta acción no se puede deshacer.`,
        onConfirm: () => {
            const updated = teams.filter(t => t.id !== teamId);
            setTeams(updated);
            localStorage.setItem('ada_teams', JSON.stringify(updated));
            postTeams(updated);
            showToast('🗑️ Equipo eliminado permanentemente');
            setConfirmDialog(null);
        },
        onCancel: () => setConfirmDialog(null)
    });
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
      <HistorialModal 
        teams={teams} 
        selectedId={selectedTeamHistory} 
        onClose={() => setSelectedTeamHistory(null)} 
        onDeleteEvaluation={(idx) => deleteEvaluation(selectedTeamHistory, idx)} 
        onUpdateEvaluation={(idx, newData) => updateEvaluation(selectedTeamHistory, idx, newData)}
        currentUser={currentUser} 
      />
      {competitionMode === 'individual' && <CompetitionOverlay 
        key={`individual-${currentUser.category}`}
        teams={teams} 
        initialCategory={currentUser.category === 'quest' ? 'quest' : 'line_follower'} 
        questTimer={questTimer} questTimerActive={questTimerActive} toggleQuestTimer={toggleQuestTimer} resetQuestTimer={resetQuestTimer} questDuration={questDuration}
        lineTimer={lineTimer} lineTimerActive={lineTimerActive} toggleLineTimer={toggleLineTimer} resetLineTimer={resetLineTimer} lineDuration={lineDuration}
        formatTime={formatTime} 
        suspenseMode={rankingSuspenseMode}
        onExit={() => setCompetitionMode(null)} />}
      {competitionMode === 'dual' && <CompetitionDualOverlay teams={teams} 
        questTimer={questTimer} questTimerActive={questTimerActive} toggleQuestTimer={toggleQuestTimer} resetQuestTimer={resetQuestTimer} questDuration={questDuration}
        lineTimer={lineTimer} lineTimerActive={lineTimerActive} toggleLineTimer={toggleLineTimer} resetLineTimer={resetLineTimer} lineDuration={lineDuration}
        formatTime={formatTime} 
        suspenseMode={rankingSuspenseMode}
        onExit={() => setCompetitionMode(null)} />}
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

      <nav className="bg-blue-950 text-white md:w-64 flex-shrink-0 flex flex-col shadow-2xl z-20 sticky top-0 md:h-screen w-full md:max-h-screen overflow-hidden">
        <div className="p-4 md:p-5 border-b border-blue-900 bg-blue-950 flex md:block items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3 md:mb-4">
            <div className="bg-blue-500 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
              <Icon name="trophy" className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h1 className="font-black text-base md:text-xl tracking-tighter leading-tight">ADAGAMES<br/><span className="text-[8px] md:text-[10px] text-blue-400 font-bold tracking-widest uppercase">{currentUser.category === 'line_follower' ? 'Line Follower' : 'Robotics Quest'}</span></h1>
          </div>
          
          <div className="hidden md:block bg-blue-900/50 p-3 rounded-xl">
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

          {/* Versión móvil del perfil - botón logout rápido */}
          <button onClick={logout} className="md:hidden p-2 bg-red-500/20 text-red-400 rounded-lg">
            <Icon name="log-out" className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrolleable horizontal en móvil, vertical en desktop */}
        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar bg-blue-900/20 md:bg-transparent border-b border-blue-900 md:border-0 no-scrollbar">
          {currentUser.role === 'admin' && (
            <>
              <NavButton active={activeTab === 'registro'} onClick={() => setActiveTab('registro')} icon={<Icon name="users" />} label="Registro" />
              <NavButton active={activeTab === 'inspeccion'} onClick={() => setActiveTab('inspeccion')} icon={<Icon name="clipboard-check" />} label="Inspección" />
              <NavButton active={activeTab === 'usuarios'} onClick={() => setActiveTab('usuarios')} icon={<Icon name="user-cog" />} label="Jueces" />
              <NavButton active={activeTab === 'config'} onClick={() => setActiveTab('config')} icon={<Icon name="map" />} label="Pistas" />
              <NavButton active={activeTab === 'fases'} onClick={() => setActiveTab('fases')} icon={<Icon name="list-checks" />} label="Fases" />
              <NavButton active={activeTab === 'sistema'} onClick={() => setActiveTab('sistema')} icon={<Icon name="settings" />} label="Sistema" />
            </>
          )}
          <NavButton active={activeTab === 'evaluacion'} onClick={() => setActiveTab('evaluacion')} icon={<Icon name="play-circle" />} label="Evaluación" />
          <NavButton active={activeTab === 'resultados'} onClick={() => setActiveTab('resultados')} icon={<Icon name="trophy" />} label="Ranking" />
        </div>

        {/* Sección Inferior de la Sidebar (Solo Desktop) */}
        <div className="hidden md:block p-4 border-t border-blue-900 space-y-3 mt-auto">
            {currentUser.role === 'admin' && (
                <div className="flex flex-col gap-2">
                    <div className="bg-blue-900/40 p-3 rounded-2xl border border-blue-800 mb-2">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Modo Suspenso (Mascara)</span>
                            <div className="relative inline-flex items-center">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={rankingSuspenseMode}
                                    onChange={(e) => setRankingSuspenseMode(e.target.checked)}
                                />
                                <div className="w-8 h-4 bg-blue-900 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                            </div>
                        </label>
                        <p className="text-[7px] font-bold text-blue-500/50 mt-1 uppercase tracking-tighter">Oculta posición y puntaje en TV</p>
                    </div>
                    <button 
                        onClick={() => setCompetitionMode('individual')}
                        className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20"
                    >
                        <Icon name="monitor" className="w-4 h-4" /> Lanzar TV Individual
                    </button>
                    <button 
                        onClick={() => setCompetitionMode('dual')}
                        className="w-full flex items-center gap-3 p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-purple-500/20"
                    >
                        <Icon name="layout" className="w-4 h-4" /> Lanzar TV Dual
                    </button>
                </div>
            )}
            
            <button 
                onClick={logout} 
                className="w-full flex items-center gap-3 p-3 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white rounded-xl transition-all border border-red-500/20 group"
            >
                <Icon name="log-out" className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Cerrar Sesión</span>
            </button>
        </div>

        {/* Indicador de conexión (Solo Desktop) */}
        <div className="p-4 border-t border-blue-900 hidden md:flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
          <span className="text-[10px] font-bold text-green-300 uppercase tracking-widest">Sincronizado</span>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-8 w-full max-w-7xl mx-auto overflow-x-hidden">
        {activeTab === 'registro' && currentUser.role === 'admin' && (
            <RegistroTab 
                addTeam={addTeam} 
                bulkAddTeams={bulkAddTeams} 
            />
        )}
        {activeTab === 'inspeccion' && currentUser.role === 'admin' && (
            <InspeccionTab 
                teams={teams} 
                updateTeamStatus={updateTeamStatus} 
                disqualifyTeam={disqualifyTeam} 
                onUpdateTeamBase={handleUpdateTeamBase}
                onDeleteTeam={handleDeleteTeam}
            />
        )}
        {activeTab === 'config' && currentUser.role === 'admin' && (
            currentUser.category === 'quest' ? 
            <ConfigTab tracks={tracks} updateTrackData={updateTrackData} /> : 
            <EvaluadorDePistas 
              initialMode="edit" 
              tracks={tracks} 
              updateTrackData={updateTrackData} 
              teams={teams} 
              activeTeams={teams.filter(t => t.status === 'inspected' && t.category === 'line_follower')} 
              addScore={addScore} 
              currentUser={currentUser} 
              disqualifyTeam={disqualifyTeam} 
              postTeams={postTeams} 
              showToast={showToast} 
              isRunningInMainApp={true}
              onUpdateTeamBase={handleUpdateTeamBase}
              onDeleteTeam={handleDeleteTeam}
            />
        )}
        {activeTab === 'usuarios' && currentUser.role === 'admin' && (
            <UsuariosTab 
                users={users} 
                fetchUsers={fetchUsers} 
                showToast={showToast} 
                setConfirmDialog={setConfirmDialog} 
            />
        )}
        {activeTab === 'evaluacion' && (
            currentUser.category === 'quest' ? 
            <EvaluacionTab teams={teams} tracks={tracks} addScore={addScore} currentUser={currentUser} disqualifyTeam={disqualifyTeam} postTeams={postTeams} showToast={showToast} timer={questTimer} competitionDuration={questDuration} onUpdateTeamBase={handleUpdateTeamBase} onDeleteTeam={handleDeleteTeam} /> : 
            <EvaluadorDePistas 
              initialMode="evaluate" 
              tracks={tracks} 
              updateTrackData={updateTrackData} 
              teams={teams} 
              activeTeams={teams.filter(t => t.status === 'inspected' && t.category === 'line_follower')} 
              addScore={addScore} 
              currentUser={currentUser} 
              disqualifyTeam={disqualifyTeam} 
              postTeams={postTeams} 
              showToast={showToast} 
              isRunningInMainApp={true}
              onUpdateTeamBase={handleUpdateTeamBase}
              onDeleteTeam={handleDeleteTeam}
            />
        )}
        {activeTab === 'resultados' && <ResultadosTab teams={teams} currentUser={currentUser} onShowHistory={setSelectedTeamHistory} />}
        {activeTab === 'sistema' && currentUser.role === 'admin' && (
            <SistemasTab 
                questDuration={questDuration} setQuestDuration={setQuestDuration} questTimerActive={questTimerActive} setQuestTimer={setQuestTimer} toggleQuestTimer={toggleQuestTimer} resetQuestTimer={resetQuestTimer}
                lineDuration={lineDuration} setLineDuration={setLineDuration} lineTimerActive={lineTimerActive} setLineTimer={setLineTimer} toggleLineTimer={toggleLineTimer} resetLineTimer={resetLineTimer}
                setShowReset={setShowReset} setShowResetScores={setShowResetScores} teams={teams} currentUser={currentUser} formatTime={formatTime}
            />
        )}
        {activeTab === 'fases' && currentUser.role === 'admin' && (
            <FasesTab 
                teams={teams} 
                onUpdateQualified={updateQualifiedRounds} 
                onUpdateManyQualified={updateManyQualifiedRounds}
                showToast={showToast}
                currentUser={currentUser}
            />
        )}
      </main>

      {/* MODAL RESET GLOBAL */}
      {showReset && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-8 transform animate-fadeIn border-2 border-red-500">
                <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon name="alert-triangle" className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-center uppercase text-slate-800 mb-2">Peligro: Reset Global</h3>
                <p className="text-[10px] text-center font-bold text-slate-500 mb-6 uppercase tracking-widest">Se borrará toda la data actual. Backup automático activo.</p>
                <input type="password" id="reset_pwd" placeholder="Contraseña Admin" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 mb-4 font-bold focus:outline-none focus:ring-2 focus:ring-red-400" />
                <div className="flex gap-2">
                    <button onClick={() => setShowReset(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                    <button onClick={() => {
                        const pwd = document.getElementById('reset_pwd').value;
                        if(pwd) handleResetCompetition(pwd);
                    }} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase hover:bg-red-700 shadow-lg shadow-red-500/30">Aniquilar</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL RESET PARCIAL (SOLO PUNTAJES) */}
      {showResetScores && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-8 transform animate-fadeIn border-2 border-orange-500">
                <div className="bg-orange-100 text-orange-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon name="refresh-cw" className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-center uppercase text-slate-800 mb-2">Reset de Puntajes</h3>
                <p className="text-[10px] text-center font-bold text-slate-500 mb-6 uppercase tracking-widest">Se borrarán puntajes, historial y tickets. LOS EQUIPOS SE MANTENDRÁN. Backup automático activo.</p>
                <input type="password" id="reset_scores_pwd" placeholder="Contraseña Admin" className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 mb-4 font-bold focus:outline-none focus:ring-2 focus:ring-orange-400" />
                <div className="flex gap-2">
                    <button onClick={() => setShowResetScores(false)} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                    <button onClick={() => {
                        const pwd = document.getElementById('reset_scores_pwd').value;
                        handleResetScores(pwd);
                    }} className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-black text-xs uppercase hover:bg-orange-700 shadow-lg shadow-orange-500/30">Limpiar</button>
                </div>
            </div>
        </div>
      )}



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

function HistorialModal({ teams, selectedId, onClose, onDeleteEvaluation, onUpdateEvaluation, currentUser }) {
    const [editingIndex, setEditingIndex] = useState(null);
    const [editPoints, setEditPoints] = useState(0);
    const [editTime, setEditTime] = useState(0);

    if (!selectedId) return null;
    const team = teams.find(t => t.id === selectedId);
    if (!team) return null;

    const handleStartEdit = (index, currentPoints, currentTime) => {
        setEditingIndex(index);
        setEditPoints(currentPoints);
        setEditTime(currentTime / 1000); // Convertir ms a s para el input
    };

    const handleSaveEdit = (index) => {
        onUpdateEvaluation(index, { 
            points: Number(editPoints), 
            percentage: Number(editPoints), // Sincronizar ambos campos por si acaso
            finalTimeMs: Number(editTime) * 1000,
            finalTime: Number(editTime) * 1000
        });
        setEditingIndex(null);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 md:p-4 animate-fadeIn">
            <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
                <div className="bg-slate-50 p-6 md:p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                        <p className="text-[9px] md:text-[10px] font-black text-blue-500 uppercase tracking-[0.15em] mb-1">Auditoría de Desempeño</p>
                        <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter leading-tight">
                            {getTeamDisplayNames(team).team}
                            <span className="text-slate-400 text-sm md:text-lg ml-2 font-bold hidden sm:inline">— {getTeamDisplayNames(team).school}</span>
                        </h3>
                    </div>
                    <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 p-3 md:p-4 rounded-xl md:rounded-2xl transition-all">
                        <Icon name="x-circle" className="text-slate-600 w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>
                <div className="p-4 md:p-8 overflow-y-auto space-y-3 md:space-y-4 custom-scrollbar flex-1 no-scrollbar">
                    {team.history.length === 0 ? (
                        <div className="text-center py-16 md:py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                             <Icon name="clipboard-check" className="w-10 h-10 md:w-12 md:h-12 text-slate-300 mx-auto mb-4" />
                             <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] md:text-sm">Sin evaluaciones</p>
                        </div>
                    ) : (
                        team.history.map((h, i) => {
                            const isEditing = editingIndex === i;
                            const timeMs = h.finalTimeMs || h.finalTime || 0;
                            
                            return (
                                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:gap-4 bg-white border border-slate-100 p-4 md:p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex-shrink-0 self-center sm:self-auto">
                                        {isEditing ? (
                                            <input 
                                                type="number" 
                                                value={editPoints} 
                                                onChange={e => setEditPoints(e.target.value)}
                                                className="w-14 md:w-16 h-10 md:h-12 border-2 border-blue-500 rounded-xl text-center font-black text-lg md:text-xl text-blue-600 outline-none"
                                            />
                                        ) : (
                                            <div className="bg-blue-600 text-white w-10 md:w-12 h-10 md:h-12 rounded-xl flex items-center justify-center font-black text-lg md:text-xl shadow-lg shadow-blue-600/20">
                                                {h.points || h.percentage || 0}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 w-full text-center sm:text-left">
                                        <p className="font-black text-slate-800 uppercase tracking-tighter text-sm md:text-base">Pista {h.pista} - {h.ronda === 5 ? 'Gran Final' : `Ronda ${h.ronda}`}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                                            <Icon name="users" className="w-3 h-3" /> {h.judgeName || 'Juez'}
                                        </p>
                                    </div>
                                    <div className="w-full sm:w-auto text-center sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                                        <div>
                                            {isEditing ? (
                                                <div className="flex flex-col items-end">
                                                    <p className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase mb-0.5">Tiempo (s)</p>
                                                    <input 
                                                        type="number" 
                                                        step="0.1"
                                                        value={editTime} 
                                                        onChange={e => setEditTime(e.target.value)}
                                                        className="w-16 md:w-20 p-1 border-2 border-blue-500 rounded text-right font-bold text-[10px] md:text-xs outline-none"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-widest leading-none">{h.date}</p>
                                                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1 leading-none">
                                                        {`${Math.floor(timeMs / 60000)}:${Math.floor((timeMs % 60000) / 1000).toString().padStart(2, '0')}.${Math.floor((timeMs % 1000) / 10).toString().padStart(2, '0')}`}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        {currentUser?.role === 'admin' && (
                                            <div className="flex gap-1.5 md:gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSaveEdit(i)} className="w-8 h-8 md:w-10 md:h-10 bg-green-500 text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-lg shadow-green-500/30">
                                                            <Icon name="check" className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setEditingIndex(null)} className="w-8 h-8 md:w-10 md:h-10 bg-slate-200 text-slate-600 rounded-lg md:rounded-xl flex items-center justify-center transition-all">
                                                            <Icon name="x" className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => handleStartEdit(i, h.points || h.percentage || 0, timeMs)} className="w-8 h-8 md:w-10 md:h-10 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all border border-blue-100">
                                                            <Icon name="edit-3" className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => {
                                                            if(window.confirm("¿Seguro?")) onDeleteEvaluation(i);
                                                        }} className="w-8 h-8 md:w-10 md:h-10 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white rounded-lg md:rounded-xl flex items-center justify-center transition-all border border-red-100">
                                                            <Icon name="trash-2" className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

function SistemasTab({ questDuration, setQuestDuration, questTimerActive, setQuestTimer, toggleQuestTimer, resetQuestTimer, lineDuration, setLineDuration, lineTimerActive, setLineTimer, toggleLineTimer, resetLineTimer, setShowReset, setShowResetScores, teams, currentUser, formatTime }) {
    const totalTeams = teams.length;
    const inspectedTeams = teams.filter(t => t.status === 'inspected').length;
    
    return (
        <>
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-fadeIn">
                <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-200">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-6 md:mb-8 uppercase italic flex items-center gap-3">
                        <Icon name="settings" className="text-blue-600 w-6 h-6 md:w-8 md:h-8" /> Ajustes del Sistema
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {/* Configuración de Tiempo Quest */}
                        <div className="space-y-4 md:space-y-6 bg-blue-50/50 p-5 md:p-6 rounded-3xl border border-blue-100">
                            <div>
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Robotics Quest</p>
                                <h4 className="text-base md:text-lg font-black text-blue-900 uppercase italic leading-tight">Duración de Competencia</h4>
                            </div>
                            
                            <div className="flex items-center gap-4 md:gap-6">
                                <div className="flex-1">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="120" 
                                        value={questDuration} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setQuestDuration(val);
                                            localStorage.setItem('ada_quest_duration', val);
                                            if (!questTimerActive) {
                                                const newTime = val * 60;
                                                setQuestTimer(newTime);
                                                localStorage.setItem('ada_quest_timer', newTime);
                                                // Sync to server
                                                fetch(`${API_BASE}/timer`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ quest: { timer: newTime, timerActive: false } })
                                                }).catch(e => console.error("Sync quest duration error:", e));
                                            }
                                        }}
                                        className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between mt-2 text-[9px] font-bold text-blue-300">
                                        <span>1 MIN</span><span>120 MIN</span>
                                    </div>
                                </div>
                                <div className="bg-white border-2 border-blue-500 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl shadow-lg">
                                    <span className="text-xl md:text-2xl font-black text-blue-600 font-mono">{questDuration}</span>
                                    <span className="text-[9px] md:text-[10px] font-black text-blue-400 ml-1 uppercase">min</span>
                                </div>
                            </div>
                        </div>

                        {/* Configuración de Tiempo Line Follower */}
                        <div className="space-y-4 md:space-y-6 bg-purple-50/50 p-5 md:p-6 rounded-3xl border border-purple-100">
                            <div>
                                <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-1">Sigue Líneas</p>
                                <h4 className="text-base md:text-lg font-black text-purple-900 uppercase italic leading-tight">Duración de Competencia</h4>
                            </div>
                            
                            <div className="flex items-center gap-4 md:gap-6">
                                <div className="flex-1">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="120" 
                                        value={lineDuration} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLineDuration(val);
                                            localStorage.setItem('ada_line_duration', val);
                                            if (!lineTimerActive) {
                                                const newTime = val * 60;
                                                setLineTimer(newTime);
                                                localStorage.setItem('ada_line_timer', newTime);
                                                // Sync to server
                                                fetch(`${API_BASE}/timer`, {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ line_follower: { timer: newTime, timerActive: false } })
                                                }).catch(e => console.error("Sync line duration error:", e));
                                            }
                                        }}
                                        className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                    />
                                    <div className="flex justify-between mt-2 text-[9px] font-bold text-purple-300">
                                        <span>1 MIN</span><span>120 MIN</span>
                                    </div>
                                </div>
                                <div className="bg-white border-2 border-purple-500 px-3 md:px-4 py-1.5 md:py-2 rounded-2xl shadow-lg">
                                    <span className="text-xl md:text-2xl font-black text-purple-600 font-mono">{lineDuration}</span>
                                    <span className="text-[9px] md:text-[10px] font-black text-purple-400 ml-1 uppercase">min</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 md:mt-8 grid grid-cols-2 gap-3 md:gap-4">
                            <div className="bg-blue-600 p-5 md:p-6 rounded-3xl shadow-xl shadow-blue-500/20 text-white flex flex-col justify-center">
                                <Icon name="users" className="mb-2 opacity-50 w-5 h-5 md:w-6 md:h-6" />
                                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">Registrados</p>
                                <p className="text-3xl md:text-4xl font-black tracking-tighter leading-none">{totalTeams}</p>
                            </div>
                            <div className="bg-emerald-500 p-5 md:p-6 rounded-3xl shadow-xl shadow-emerald-500/20 text-white flex flex-col justify-center">
                                <Icon name="check-circle" className="mb-2 opacity-50 w-5 h-5 md:w-6 md:h-6" />
                                <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest opacity-80">Revisados</p>
                                <p className="text-3xl md:text-4xl font-black tracking-tighter leading-none">{inspectedTeams}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-slate-100">
                        <h3 className="text-base md:text-lg font-black text-red-600 uppercase italic mb-4 flex items-center gap-2">
                            <Icon name="alert-triangle" className="w-5 h-5" /> Zona de Peligro
                        </h3>
                        <div className="bg-red-50 border border-red-100 p-5 md:p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-5 md:gap-6">
                            <div className="text-center sm:text-left">
                                <p className="font-black text-red-900 uppercase text-xs md:text-sm">Reiniciar Competencia</p>
                                <p className="text-[9px] md:text-[10px] font-bold text-red-500/70 uppercase tracking-widest mt-1">Se borrará toda la data histórica (Incluye equipos).</p>
                            </div>
                            <button 
                                onClick={() => setShowReset(true)}
                                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-500/30 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Icon name="trash-2" className="w-4 h-4" /> Aniquilar Todo
                            </button>
                        </div>

                        <div className="bg-orange-50 border border-orange-100 p-5 md:p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-5 md:gap-6">
                            <div className="text-center sm:text-left">
                                <p className="font-black text-orange-900 uppercase text-xs md:text-sm">Limpiar Resultados</p>
                                <p className="text-[9px] md:text-[10px] font-bold text-orange-500/70 uppercase tracking-widest mt-1">Mantiene los equipos. Borra puntajes, historial y tickets.</p>
                            </div>
                            <button 
                                onClick={() => setShowResetScores(true)}
                                className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Icon name="refresh-cw" className="w-4 h-4" /> Reset Parcial
                            </button>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-[9px] md:text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] md:tracking-[0.3em]">Adagames V4.0 Engine &bull; Admin Mode</p>
                </div>
            </>
        );
    }

function NavButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex-shrink-0 md:flex-none flex flex-col md:flex-row items-center gap-1 md:gap-3 p-3 md:p-4 transition-all duration-200 border-b-2 md:border-b-0 md:border-l-4 ${
      active ? 'bg-blue-600/20 md:bg-blue-600 text-white border-blue-500 shadow-lg' : 'text-blue-300/50 border-transparent hover:bg-blue-900 hover:text-white'
    }`}>
      <span className="w-5 h-5 flex items-center justify-center">{icon}</span>
      <span className="text-[8px] md:text-sm font-black uppercase tracking-wider whitespace-nowrap">{label}</span>
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
    } else if (mode === 'bonus_start') {
      updateTrackData(selRonda, selPista, { 
        bonusStart: currentTrack.bonusStart === id ? '' : id
      });
    } else {
      const isObs = currentTrack.obstacles.includes(id);
      updateTrackData(selRonda, selPista, { 
        obstacles: isObs ? currentTrack.obstacles.filter(c => c !== id) : [...currentTrack.obstacles, id],
        sequence: currentTrack.sequence.filter(c => c !== id)
      });
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 animate-fadeIn">
      <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-3xl shadow-xl border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="space-y-3 md:space-y-4 w-full lg:w-auto">
            <h2 className="text-xl md:text-2xl font-black text-blue-900 tracking-tight uppercase leading-tight">Configurador de Mapas</h2>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {[1, 2, 3, 4, 5].map(r => (
                <button key={r} onClick={() => setSelRonda(r)} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[9px] md:text-xs font-black transition-all ${selRonda === r ? 'bg-blue-600 text-white shadow-blue-500/40 shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {r === 5 ? 'FINAL' : `R${r}`}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {[1, 2, 3, 4, 5].map(p => (
                <button key={p} onClick={() => setSelPista(p)} className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[9px] md:text-xs font-black transition-all ${selPista === p ? 'bg-blue-400 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                  P{p}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl w-full lg:w-auto mt-2 lg:mt-0 overflow-x-auto no-scrollbar">
            <button onClick={() => setMode('sequence')} className={`flex-1 lg:flex-none px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-[9px] md:text-xs font-black flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${mode === 'sequence' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600" /> RUTA
            </button>
            <button onClick={() => setMode('obstacle')} className={`flex-1 lg:flex-none px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-[9px] md:text-xs font-black flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${mode === 'obstacle' ? 'bg-white text-red-600 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
              <Icon name="x-circle" className="w-3 h-3 text-red-600" /> OBSTÁCULO
            </button>
            <button onClick={() => setMode('bonus_start')} className={`flex-1 lg:flex-none px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-[9px] md:text-xs font-black flex items-center justify-center gap-1.5 md:gap-2 transition-all whitespace-nowrap ${mode === 'bonus_start' ? 'bg-white text-yellow-600 shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>
              ⭐ BONUS
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 md:gap-8">
          <div className="xl:col-span-3 flex flex-col items-center">
            <div className="w-full overflow-x-auto pb-4 custom-scrollbar no-scrollbar relative">
              <div className="inline-block min-w-[650px] border-[6px] md:border-[8px] border-blue-600 rounded-[1.5rem] md:rounded-2xl bg-white shadow-2xl overflow-hidden mx-auto">
                <div className="grid grid-cols-11 bg-blue-600 text-white font-black text-[10px] md:text-[12px]">
                  <div className="p-2 md:p-3 border-r border-blue-500/50 flex items-center justify-center bg-blue-700">#</div>
                  {COLS.map(c => <div key={c} className="p-2 md:p-3 text-center flex items-center justify-center">{c}</div>)}
                </div>
                {ROWS.map(r => (
                  <div key={r} className="grid grid-cols-11 border-b border-blue-50 last:border-0">
                    <div className="bg-blue-600 text-white font-black text-[10px] md:text-[12px] flex items-center justify-center border-r border-blue-500/50 p-3 md:p-4">{r}</div>
                    {COLS.map(c => {
                      const id = `${c}${r}`;
                      const seqIdx = currentTrack.sequence.indexOf(id);
                      const isObs = currentTrack.obstacles.includes(id);
                      const isBonusStart = currentTrack.bonusStart === id;
                      return (
                        <button key={id} onClick={() => toggleCell(id)} className={`aspect-square border-r border-blue-50 last:border-0 flex items-center justify-center relative hover:bg-blue-50 transition-colors ${isObs ? 'bg-red-50' : ''}`}>
                          {isBonusStart && (
                              <div className="absolute -top-1.5 md:-top-2 -right-1.5 md:-right-2 w-5 h-5 md:w-8 md:h-8 bg-yellow-400 flex items-center justify-center shadow-xl rounded-full transform border border-yellow-200 z-20 text-[10px] md:text-sm">
                                ⭐
                              </div>
                          )}
                          {seqIdx > -1 && (
                            <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-blue-600 text-white font-black flex items-center justify-center shadow-lg border md:border-2 border-blue-300 text-[10px] md:text-sm">
                              {seqIdx + 1}
                            </div>
                          )}
                          {isObs && (
                            <div className="w-7 h-7 md:w-10 md:h-10 bg-red-600 flex items-center justify-center shadow-xl rounded-md transform border md:border-2 border-red-400">
                              <Icon name="x-circle" className="text-white w-4 h-4 md:w-7 md:h-7" />
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
          
          <div className="bg-blue-50/50 p-5 md:p-6 rounded-[2rem] md:rounded-3xl border border-blue-100 h-fit">
            <h3 className="font-black text-blue-900 text-[11px] md:text-sm mb-4 flex items-center gap-2 uppercase">
              <Icon name="star" className="text-blue-600 w-4 h-4"/> Resumen Pista {selPista}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 xl:grid-cols-1 gap-3 md:gap-4">
                <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-blue-100">
                  <p className="text-[9px] md:text-[10px] font-bold text-blue-400 mb-0.5 md:mb-1 uppercase">Puntos Ruta</p>
                  <p className="text-2xl md:text-3xl font-black text-blue-600 leading-none">{currentTrack.sequence.length}</p>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-red-100">
                  <p className="text-[9px] md:text-[10px] font-bold text-red-400 mb-0.5 md:mb-1 uppercase">Obstáculos</p>
                  <p className="text-2xl md:text-3xl font-black text-red-50">{currentTrack.obstacles.length}</p>
                </div>
              </div>

              {/* BONUS SETTINGS */}
              <div className="bg-yellow-50/50 p-4 rounded-2xl shadow-sm border border-yellow-200 mt-4 space-y-3">
                  <h4 className="text-[9px] md:text-[10px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-1 mb-1">
                      <Icon name="star" className="w-3 h-3"/> Ajustes de Bonus
                  </h4>
                  <div>
                      <p className="text-[8px] md:text-[9px] font-bold text-yellow-600 mb-1 uppercase">Orientación</p>
                      <div className="flex gap-1">
                          {['N', 'S', 'E', 'O'].map(dir => (
                              <button key={dir} onClick={() => updateTrackData(selRonda, selPista, { bonusDir: dir === currentTrack.bonusDir ? '' : dir })} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${currentTrack.bonusDir === dir ? 'bg-yellow-500 text-white shadow-md' : 'bg-white text-yellow-600 border border-yellow-200 hover:bg-yellow-100'}`}>
                                  {dir}
                              </button>
                          ))}
                      </div>
                  </div>
                  <div>
                      <p className="text-[8px] md:text-[9px] font-bold text-yellow-600 mb-1 uppercase">Reglas</p>
                      <textarea 
                          value={currentTrack.bonusRules || ''} 
                          onChange={(e) => updateTrackData(selRonda, selPista, { bonusRules: e.target.value })}
                          className="w-full text-[10px] p-2 md:p-3 rounded-xl border border-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-yellow-800 placeholder-yellow-300 font-bold leading-tight"
                          placeholder="Nota del bonus..."
                          rows={2}
                      />
                  </div>
              </div>

              <button onClick={() => updateTrackData(selRonda, selPista, { sequence: [], obstacles: [], bonusStart: '', bonusDir: '', bonusRules: '' })} className="w-full py-3 md:py-4 text-red-500 text-[9px] md:text-[10px] font-black hover:bg-red-50 rounded-2xl transition-all border border-red-200 flex items-center justify-center gap-2 uppercase">
                <Icon name="trash-2" className="w-3.5 h-3.5 md:w-4 md:h-4" /> Limpiar Pista
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function EvaluacionTab({ teams, tracks, addScore, currentUser, disqualifyTeam, postTeams, showToast, timer, competitionDuration, onUpdateTeamBase, onDeleteTeam }) {
  const [selRonda, setSelRonda] = useState(1);
  
  if (currentUser.category === 'line_follower') {
    return <LineFollowerEvaluacion teams={teams} addScore={addScore} currentUser={currentUser} disqualifyTeam={disqualifyTeam} postTeams={postTeams} showToast={showToast} selRonda={selRonda} />;
  }

  const [selTeam, setSelTeam] = useState('');
  const [selPista, setSelPista] = useState(1);
  const [attemptType, setAttemptType] = useState('practice'); // 'practice' | 'evaluation'
  const [progressIdx, setProgressIdx] = useState(-1);
  const [bonus, setBonus] = useState(false);
  const [bonusIntention, setBonusIntention] = useState(null);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  
  const activeTeams = teams.filter(t => t.status === 'inspected' && (t.qualifiedRounds || [1]).includes(selRonda));
  const track = (tracks[selRonda] && tracks[selRonda][selPista])
                ? tracks[selRonda][selPista]
                : { sequence: [], obstacles: [] };

  // Pillar 2: Reglas de negocio (Bloqueo de duplicados)
  // Solo bloquea si hay una evaluación OFICIAL (practice !== true) para esa ronda+pista
  const existingEvaluation = useMemo(() => {
    if (!selTeam) return null;
    const team = teams.find(t => t.id === selTeam);
    return team?.history.find(h => h.ronda === selRonda && h.pista === selPista && h.practice !== true);
  }, [teams, selTeam, selRonda, selPista]);

  const selectedTeamData = useMemo(() => teams.find(t => t.id === selTeam), [teams, selTeam]);
  const practiceRemaining = selectedTeamData?.practiceTickets !== undefined ? selectedTeamData.practiceTickets : 5;
  const evalRemaining = (selectedTeamData?.evaluationTickets?.[selPista] !== undefined ? selectedTeamData.evaluationTickets[selPista] : 1) > 0;

  // Forzar tipo de intento si no hay tickets de práctica
  useEffect(() => {
    if (selTeam) {
        if (practiceRemaining <= 0) {
            setAttemptType('evaluation');
        } else if (!evalRemaining) {
            setAttemptType('practice');
        }
    }
  }, [selTeam, practiceRemaining, evalRemaining]);

  const handleSave = () => {
    if (!selTeam) return;
    const isPractice = attemptType === 'practice';
    if (!isPractice && !evalRemaining) {
        showToast('Este equipo ya no tiene tickets de evaluación para esta pista', 'error');
        return;
    }
    if (isPractice && practiceRemaining <= 0) {
        showToast('Este equipo ya no tiene tickets de práctica', 'error');
        return;
    }
    if (attemptType === 'practice_to_eval' && (practiceRemaining <= 0 || !evalRemaining)) {
        showToast('Tickets insuficientes para oficializar práctica', 'error');
        return;
    }

    setShowConfirmSave(true);
  };

  const confirmSave = () => {
    const total = (progressIdx + 1) + (bonus ? 3 : 0);
    
    let finalTimeMs = 0;
    if (selPista === 5) {
        // Tiempo transcurrido = duración_competencia - timer_actual
        let timeTakenSeconds = (competitionDuration * 60) - timer;
        if (timeTakenSeconds < 0) timeTakenSeconds = 0;
        finalTimeMs = timeTakenSeconds * 1000;
    }
    
    addScore(selTeam, selRonda, selPista, total, finalTimeMs, attemptType);
    setSelTeam('');
    setProgressIdx(-1);
    setBonus(false);
    setBonusIntention(null);
    setAttemptType('practice');
    setShowConfirmSave(false);
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
                <div className="flex gap-2">
                    <select value={selTeam} onChange={e => {setSelTeam(e.target.value); setProgressIdx(-1); setBonusIntention(null);}} className="flex-1 p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 font-bold outline-none focus:border-blue-500 transition-all text-blue-900">
                        <option value="">-- Seleccionar Equipo --</option>
                        {activeTeams.map(t => <option key={t.id} value={t.id}>{t.teamName} ({t.schoolName})</option>)}
                    </select>
                    {selTeam && currentUser?.role === 'admin' && (
                        <button onClick={() => setShowEditTeam(true)} className="bg-white border-2 border-blue-100 p-4 rounded-2xl text-blue-500 hover:bg-blue-50 transition-all">
                            <Icon name="settings" className="w-6 h-6" />
                        </button>
                    )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Ronda</label>
                  <select value={selRonda} onChange={e => {setSelRonda(parseInt(e.target.value)); setProgressIdx(-1); setBonusIntention(null);}} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm">
                    {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r === 5 ? 'Final' : `Ronda ${r}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Pista</label>
                  <select value={selPista} onChange={e => {setSelPista(parseInt(e.target.value)); setProgressIdx(-1); setBonusIntention(null);}} className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm">
                    {[1, 2, 3, 4, 5].map(p => <option key={p} value={p}>Pista {p}</option>)}
                  </select>
                </div>
              </div>

              {selTeam && (
                <>
                  <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 space-y-3">
                      <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">Tickets de Práctica</span>
                          <div className="flex gap-1">
                              {[1,2,3,4,5].map(i => (
                                  <div key={i} className={`w-3 h-5 rounded-sm border ${i <= practiceRemaining ? 'bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.4)]' : 'bg-slate-200 border-slate-300 opacity-30'}`}></div>
                              ))}
                          </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-orange-100/50">
                          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Evaluación P{selPista}</span>
                          <div className={`w-10 h-5 rounded-full flex items-center px-1 transition-all ${evalRemaining ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                              <div className={`w-2 h-2 rounded-full mr-1 ${evalRemaining ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                              <span className="text-[8px] font-black">{evalRemaining ? 'DISP.' : 'AGOT.'}</span>
                          </div>
                      </div>
                  </div>

                  <div className="pt-2">
                      <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2 text-center">Tipo de Intento</label>
                      <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => setAttemptType('practice')}
                                  disabled={practiceRemaining <= 0}
                                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${attemptType === 'practice' ? 'bg-orange-600 border-orange-500 text-white shadow-lg shadow-orange-600/30' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'} ${practiceRemaining <= 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                              >
                                  🎟️ Práctica Libre
                              </button>
                              <button 
                                  onClick={() => setAttemptType('evaluation')}
                                  disabled={!evalRemaining}
                                  className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${attemptType === 'evaluation' ? 'bg-green-600 border-green-500 text-white shadow-lg shadow-green-600/30' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'} ${!evalRemaining ? 'opacity-30 cursor-not-allowed' : ''}`}
                              >
                                  🎯 Evaluación
                              </button>
                          </div>
                          <button 
                              onClick={() => setAttemptType('practice_to_eval')}
                              disabled={practiceRemaining <= 0 || !evalRemaining}
                              className={`w-full py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${attemptType === 'practice_to_eval' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'} ${practiceRemaining <= 0 || !evalRemaining ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                              ⭐ Práctica + Evaluación
                          </button>
                      </div>
                      {practiceRemaining <= 0 && attemptType === 'evaluation' && (
                          <p className="text-[8px] font-bold text-red-500 mt-2 text-center uppercase tracking-tighter animate-bounce">⚠️ Tickets de práctica agotados. Muerte Súbita.</p>
                      )}
                  </div>
                </>
              )}

              {existingEvaluation && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex gap-3 items-start animate-fadeIn">
                    <Icon name="info" className="text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Ya evaluado</p>
                        <p className="text-xs text-orange-800 font-medium">Este equipo ya fue evaluado por <strong>{existingEvaluation.judgeName}</strong>.</p>
                    </div>
                </div>
              )}

              {/* MÓDULO INTENCIÓN DE BONUS */}
              {!existingEvaluation && selTeam && (
                <div className="pt-4 border-t border-slate-100 animate-fadeIn">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">¿El equipo realizará el intento de Bonus?</label>
                    <div className="flex gap-2 mb-4">
                        <button onClick={() => setBonusIntention(true)} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${bonusIntention === true ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-400/30 border-2 border-yellow-400' : 'bg-white text-slate-400 border-2 border-slate-100 hover:bg-slate-50'}`}>SÍ, VA POR BONUS</button>
                        <button onClick={() => { setBonusIntention(false); setBonus(false); }} className={`flex-1 py-3 rounded-xl font-black text-xs uppercase transition-all ${bonusIntention === false ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/30 border-2 border-slate-800' : 'bg-white text-slate-400 border-2 border-slate-100 hover:bg-slate-50'}`}>NO</button>
                    </div>

                    {bonusIntention === true && (
                        <div className="bg-yellow-50/50 border border-yellow-200 p-4 rounded-xl mb-4 text-left relative overflow-hidden animate-fadeIn">
                            <h4 className="text-[10px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-1 mb-2">
                                <Icon name="star" className="w-3 h-3" /> Reglas del Bonus
                            </h4>
                            {track.bonusStart && (
                                <p className="text-xs font-bold text-yellow-800 mb-2 flex items-center gap-2">
                                    <span className="bg-yellow-200 px-2 py-0.5 rounded text-yellow-900 shadow-sm flex items-center gap-1">⭐ {track.bonusStart}</span>
                                    {track.bonusDir && (
                                        <span className="bg-yellow-200 px-2 py-0.5 rounded text-yellow-900 shadow-sm flex items-center gap-1">
                                            {track.bonusDir === 'N' ? 'N ⬆' : track.bonusDir === 'S' ? 'S ⬇' : track.bonusDir === 'E' ? 'E ➡' : track.bonusDir === 'O' ? 'O ⬅' : ''}
                                        </span>
                                    )}
                                </p>
                            )}
                            <p className="text-xs font-medium text-yellow-700 italic border-t border-yellow-200/50 pt-2">{track.bonusRules || 'No hay notas adicionales'}</p>
                        </div>
                    )}
                </div>
              )}

              <div className={`pt-2 transition-opacity duration-300 ${(!bonusIntention || existingEvaluation) ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                <button 
                  onClick={() => setBonus(!bonus)}
                  disabled={existingEvaluation || !bonusIntention}
                  className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${bonus ? 'bg-yellow-400 border-yellow-300 text-white shadow-lg shadow-yellow-400/30' : 'bg-white border-yellow-200 text-yellow-600 hover:bg-yellow-50'} ${existingEvaluation ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon name="star" className={bonus ? 'fill-white' : ''} /> LO LOGRARON (+3 PTS)
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
          <div className="text-center mb-6 md:mb-8">
            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-blue-200">Panel de Seguimiento</span>
            <h3 className="text-xl md:text-3xl font-black text-blue-900 mt-3 uppercase italic leading-tight">Pista {selPista} - {selRonda === 5 ? 'Gran Final' : `Ronda ${selRonda}`}</h3>
            {!selTeam && <p className="text-orange-500 font-bold text-xs md:text-sm mt-2 flex items-center justify-center gap-2"><Icon name="info" className="w-4 h-4"/> Selecciona un equipo para evaluar</p>}
          </div>
          <div className="w-full overflow-x-auto pb-4 custom-scrollbar relative no-scrollbar">
            {!selTeam && <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px]"></div>}
            <div className="inline-block min-w-[650px] border-[6px] md:border-[10px] border-blue-600 rounded-[1.5rem] md:rounded-[2rem] bg-white shadow-2xl overflow-hidden mx-auto">
              <div className="grid grid-cols-11 bg-blue-600 text-white font-black text-[10px] md:text-[11px]">
                <div className="p-2 md:p-3 border-r border-blue-500/50 bg-blue-700 text-center flex items-center justify-center">#</div>
                {COLS.map(c => <div key={c} className="p-2 md:p-3 text-center flex items-center justify-center">{c}</div>)}
              </div>
              {ROWS.map(r => (
                <div key={r} className="grid grid-cols-11 border-b border-blue-50 last:border-0">
                  <div className="bg-blue-600 text-white font-black text-[10px] md:text-[11px] flex items-center justify-center border-r border-blue-500/50 p-2 md:p-3">{r}</div>
                  {COLS.map(c => {
                    const id = `${c}${r}`;
                    const seqIdx = track.sequence.indexOf(id);
                    const isObs = track.obstacles.includes(id);
                    const evalIdx = existingEvaluation ? existingEvaluation.points - (existingEvaluation.points > track.sequence.length ? 3 : 0) - 1 : -1;
                    const isReached = seqIdx !== -1 && (existingEvaluation ? seqIdx <= evalIdx : seqIdx <= progressIdx);
                    const isBonusStart = bonusIntention && track.bonusStart === id;
                    
                    return (
                      <button 
                        key={id} disabled={seqIdx === -1 || !selTeam || existingEvaluation}
                        onClick={() => setProgressIdx(seqIdx === progressIdx ? seqIdx - 1 : seqIdx)}
                        className={`aspect-square border-r border-blue-50 last:border-0 flex items-center justify-center relative transition-all ${isReached ? 'bg-green-50' : ''}`}
                      >
                        {isBonusStart && (
                            <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-5 h-5 md:w-8 md:h-8 bg-yellow-400 flex items-center justify-center shadow-xl rounded-full transform border border-yellow-200 z-20 text-[10px] md:text-sm animate-pulse">
                              ⭐
                            </div>
                        )}
                        {seqIdx > -1 && (
                          <div className={`w-8 h-8 md:w-12 md:h-12 rounded-full font-black flex items-center justify-center text-[10px] md:text-xs transition-all border-2 md:border-4 ${isReached ? 'bg-green-500 border-green-200 text-white md:scale-110 shadow-xl' : 'bg-white border-blue-500 text-blue-600 shadow-sm'}`}>
                            {seqIdx + 1}
                          </div>
                        )}
                        {isObs && (
                          <div className="w-8 h-8 md:w-12 md:h-12 bg-red-600 flex items-center justify-center shadow-xl rounded-lg transform border-2 border-red-400">
                            <Icon name="x-circle" className="text-white w-5 h-5 md:w-6 md:h-6" />
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
      
      {showEditTeam && selTeam && teams && (
          <EditTeamModal 
              team={teams.find(t => t.id === selTeam)} 
              onClose={() => setShowEditTeam(false)} 
              onSave={(name, school) => {
                  if (onUpdateTeamBase) onUpdateTeamBase(selTeam, name, school);
                  setShowEditTeam(false);
              }} 
              onDelete={() => {
                  setShowEditTeam(false);
                  if (onDeleteTeam) onDeleteTeam(selTeam);
                  setSelTeam('');
              }}
          />
      )}
      {showConfirmSave && selTeam && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
              <div className="bg-white border border-slate-200 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                  <div className="bg-blue-600 p-6 text-center shrink-0">
                      <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Icon name="save" className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-black text-white uppercase tracking-wider mb-1">Confirmar Registro</h3>
                      <p className="text-blue-200 text-xs font-medium">Revisa los datos antes de guardar</p>
                  </div>
                  
                  <div className="p-6 flex flex-col gap-4 flex-1 bg-slate-50">
                      <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-sm">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">Equipo a Evaluar</p>
                          <p className="text-sm font-black text-blue-900 uppercase truncate px-2">{selectedTeamData?.teamName}</p>
                      </div>

                      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 shadow-sm">
                          <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ronda</p>
                              <p className="text-sm font-bold text-slate-700">Ronda {selRonda}</p>
                          </div>
                          <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pista</p>
                              <p className="text-sm font-bold text-slate-700">Pista {selPista}</p>
                          </div>
                      </div>

                      <div className={`p-4 rounded-xl border shadow-sm ${attemptType === 'practice' ? 'bg-orange-50 border-orange-200' : attemptType === 'evaluation' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                          <p className="text-[10px] font-bold tracking-wider mb-1 uppercase text-slate-500">Tipo de Registro</p>
                          <p className={`text-sm font-black uppercase flex items-center gap-2 ${attemptType === 'practice' ? 'text-orange-600' : attemptType === 'evaluation' ? 'text-green-600' : 'text-blue-600'}`}>
                              {attemptType === 'practice' ? '🎟️ Práctica Libre' : attemptType === 'evaluation' ? '🎯 Evaluación Oficial' : '⭐ Práctica + Evaluación'}
                          </p>
                      </div>

                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-3 shadow-lg transform transition-all hover:scale-[1.02]">
                          <div className="flex justify-between items-center px-2">
                              <div>
                                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Puntos Base</p>
                                  <p className="text-2xl font-black text-white">{progressIdx + 1} <span className="text-xs text-slate-500">PTS</span></p>
                              </div>
                              <div className="text-right">
                                  <p className="text-[10px] text-yellow-500 uppercase font-black tracking-widest">Bonus</p>
                                  <p className="text-2xl font-black text-yellow-400">{bonus ? '+3' : '+0'} <span className="text-xs text-yellow-600/50">PTS</span></p>
                              </div>
                          </div>
                          <div className="bg-blue-600 p-3 rounded-xl border border-blue-500 text-center shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                              <p className="text-[10px] text-blue-200 uppercase font-black tracking-widest mb-1">Puntaje Final a Registrar</p>
                              <p className="text-4xl font-black text-white">{((progressIdx + 1) + (bonus ? 3 : 0))}</p>
                          </div>
                      </div>

                      {selPista === 5 && (
                          <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm text-center">
                              <p className="text-[10px] text-blue-600 uppercase font-black tracking-widest mb-1">Tiempo de Ronda Capturado</p>
                              <p className="text-3xl font-mono font-black text-blue-600">
                                  {(() => {
                                      let ts = (competitionDuration * 60) - timer;
                                      if (ts < 0) ts = 0;
                                      const m = Math.floor(ts / 60).toString().padStart(2, '0');
                                      const s = (ts % 60).toString().padStart(2, '0');
                                      return `${m}:${s}`;
                                  })()}
                              </p>
                              <p className="text-[9px] text-blue-500 font-bold mt-1">Sincronizado con el Reloj Global de TV.</p>
                          </div>
                      )}

                      <div className="pt-2 flex gap-3">
                          <button onClick={() => setShowConfirmSave(false)} className="flex-1 py-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold rounded-xl transition-all">
                              Cancelar
                          </button>
                          <button onClick={confirmSave} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                              <Icon name="save" className="w-5 h-5" /> GUARDAR
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

function RegistroTab({ addTeam, bulkAddTeams }) {
  const [teamName, setTeamName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [cap, setCap] = useState('');
  const [coach, setCoach] = useState('');
  const [member1, setMember1] = useState('');
  const [member2, setMember2] = useState('');
  const [member3, setMember3] = useState('');
  const [importPreview, setImportPreview] = useState(null); // null | array de equipos
  const [importError, setImportError] = useState('');
  const fileInputRef = React.useRef(null);

  const getMembers = () => [member1, member2, member3].filter(m => m.trim() !== '');

  const handleAdd = () => {
    if (!teamName || !schoolName || !cap) return;
    const members = getMembers();
    addTeam({
      teamName: teamName,
      schoolName: schoolName,
      school: `${teamName} — ${schoolName}`, // Legacy support
      captainName: cap,
      coachName: coach,
      members,
      studentsCount: members.length || 1,
    });
    setTeamName(''); setSchoolName(''); setCap(''); setCoach('');
    setMember1(''); setMember2(''); setMember3('');
  };

  // ---------- DESCARGA DE PLANTILLA ----------
  const downloadTemplate = () => {
    const csvContent = [
      ['Nombre Equipo', 'Colegio', 'Capitan', 'Coach', 'Integrante 1', 'Integrante 2', 'Integrante 3'],
      ['Team Alpha', 'U.E. Simón Bolívar', 'María López', 'Prof. Pérez', 'Juan García', 'Pedro Mora', 'Luis Rivas'],
      ['Team Beta', 'U.E. Andrés Bello', 'Carlos Ruiz', 'Prof. Gómez', 'Ana Torres', 'Diego Silva', ''],
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_equipos_adagames.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // ---------- PARSEO DE EXCEL / CSV ----------
  const handleFileChange = (e) => {
    setImportError('');
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        if (!window.XLSX) {
          setImportError('La librería de Excel no está disponible. Revisa tu conexión a internet.');
          return;
        }
        const data = new Uint8Array(evt.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          setImportError('El archivo no tiene datos. Usa la plantilla descargable.');
          return;
        }

        // Buscar encabezados (fila 0)
        const headers = rows[0].map(h => String(h).toLowerCase().trim());
        const COL = {
          teamName: headers.findIndex(h => h.includes('nombre equipo') || h === 'equipo'),
          schoolName: headers.findIndex(h => h.includes('colegio') || h.includes('instituci') || h.includes('escuela')),
          captain: headers.findIndex(h => h.includes('capit')),
          coach: headers.findIndex(h => h.includes('coach') || h.includes('entrenad')),
          m1: headers.findIndex(h => h.includes('integrante 1') || h === 'integrante1'),
          m2: headers.findIndex(h => h.includes('integrante 2') || h === 'integrante2'),
          m3: headers.findIndex(h => h.includes('integrante 3') || h === 'integrante3'),
        };

        const parsed = rows.slice(1).filter(row => row.some(cell => String(cell).trim() !== '')).map(row => {
          const teamName = COL.teamName >= 0 ? String(row[COL.teamName] || '').trim() : '';
          const schoolName = COL.schoolName >= 0 ? String(row[COL.schoolName] || '').trim() : '';
          const captain = COL.captain >= 0 ? String(row[COL.captain] || '').trim() : '';
          const coach = COL.coach >= 0 ? String(row[COL.coach] || '').trim() : '';
          const members = [
            COL.m1 >= 0 ? String(row[COL.m1] || '').trim() : '',
            COL.m2 >= 0 ? String(row[COL.m2] || '').trim() : '',
            COL.m3 >= 0 ? String(row[COL.m3] || '').trim() : '',
          ].filter(m => m !== '');
          return { 
            teamName, 
            schoolName, 
            school: teamName && schoolName ? `${teamName} — ${schoolName}` : (teamName || schoolName),
            captainName: captain, 
            coachName: coach, 
            members, 
            studentsCount: members.length || 1, 
            _valid: !!teamName && !!schoolName && !!captain 
          };
        });

        if (parsed.length === 0) {
          setImportError('No se encontraron filas válidas. Verifica el formato del archivo.');
          return;
        }
        setImportPreview(parsed);
      } catch (err) {
        setImportError('Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-imported if needed
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    const valid = importPreview.filter(t => t._valid).map(({ _valid, ...team }) => team);
    if (valid.length === 0) return;
    // Una sola llamada de API para todos los equipos — evita la condición de carrera
    bulkAddTeams(valid);
    setImportPreview(null);
  };

  return (
    <>
      {/* MODAL DE VISTA PREVIA DE IMPORTACIÓN */}
      {importPreview && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Vista Previa de Importación</p>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {importPreview.filter(t => t._valid).length} equipos válidos
                  {importPreview.filter(t => !t._valid).length > 0 && (
                    <span className="text-sm font-bold text-red-400 ml-2">
                      ({importPreview.filter(t => !t._valid).length} con errores serán omitidos)
                    </span>
                  )}
                </h3>
              </div>
              <button onClick={() => setImportPreview(null)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-xl transition-all">
                <Icon name="x" className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-3 custom-scrollbar">
              {importPreview.map((team, i) => (
                <div key={i} className={`p-4 rounded-2xl border-2 ${team._valid ? 'border-blue-100 bg-blue-50/50' : 'border-red-100 bg-red-50/50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className={`font-black text-sm uppercase tracking-tight ${team._valid ? 'text-blue-900' : 'text-red-400'}`}>
                        {team.teamName || <span className="italic">Sin equipo</span>}
                        {team.schoolName && <span className="text-slate-400 font-bold ml-2">— {team.schoolName}</span>}
                        {!team._valid && <span className="ml-2 text-[10px] bg-red-100 text-red-500 px-2 py-0.5 rounded-full font-black uppercase">INCOMPLETO</span>}
                      </p>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        👤 Capitán: <span className="text-slate-700">{team.captainName || '—'}</span>
                        {team.coachName && <> · 🏅 Coach: <span className="text-slate-700">{team.coachName}</span></>}
                      </p>
                      {team.members.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {team.members.map((m, mi) => (
                            <span key={mi} className="bg-white border border-blue-200 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${team._valid ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Icon name={team._valid ? 'check' : 'x'} className={`w-4 h-4 ${team._valid ? 'text-green-600' : 'text-red-500'}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button onClick={() => setImportPreview(null)} className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black rounded-xl text-sm uppercase tracking-widest transition-all">
                Cancelar
              </button>
              <button
                onClick={confirmImport}
                disabled={!importPreview.some(t => t._valid)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
              >
                <Icon name="upload" className="w-4 h-4" />
                Confirmar Importación ({importPreview.filter(t => t._valid).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECCIÓN DE IMPORTACIÓN */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-100 p-2 rounded-xl">
            <Icon name="file-spreadsheet" className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Registro Masivo por Excel</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Importa múltiples equipos de una sola vez</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={downloadTemplate}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 text-slate-600 font-black text-xs rounded-xl transition-all uppercase tracking-widest"
          >
            <Icon name="download" className="w-4 h-4 text-slate-500" />
            Descargar Plantilla (.csv)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-black text-xs rounded-xl transition-all uppercase tracking-widest shadow-lg shadow-green-600/20"
          >
            <Icon name="upload" className="w-4 h-4" />
            Importar Archivo (.xlsx / .csv)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
        {importError && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-xs font-bold p-3 rounded-xl">
            <Icon name="alert-triangle" className="w-4 h-4 flex-shrink-0" />
            {importError}
          </div>
        )}
      </div>

      {/* FORMULARIO MANUAL */}
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-slate-200">
        <h2 className="text-2xl md:text-4xl font-black text-blue-900 mb-6 md:mb-8 tracking-tighter uppercase italic text-center leading-tight">Registro Manual</h2>
        <div className="space-y-4 md:space-y-5">
          {/* Nombre del equipo e Institución */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Nombre del Equipo</label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 text-base md:text-lg transition-all" placeholder="Ej: Team Alpha" />
            </div>
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Institución / Colegio</label>
              <input value={schoolName} onChange={e => setSchoolName(e.target.value)} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 text-base md:text-lg transition-all" placeholder="Ej: U.E. Simón Bolívar" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {/* Capitán */}
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Capitán / Líder</label>
              <input value={cap} onChange={e => setCap(e.target.value)} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-sm md:text-base" placeholder="Nombre completo" />
            </div>
            {/* Coach */}
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block">Coach / Entrenador</label>
              <input value={coach} onChange={e => setCoach(e.target.value)} className="w-full p-3 md:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-sm md:text-base" placeholder="Nombre completo" />
            </div>
          </div>

          {/* Integrantes */}
          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 block flex items-center gap-2">
              Integrantes del Equipo <span className="bg-blue-100 text-blue-500 px-2 py-0.5 rounded-lg text-[9px] font-black">MÁX. 3</span>
            </label>
            <div className="space-y-3">
              {[
                { val: member1, set: setMember1, label: 'Integrante 1' },
                { val: member2, set: setMember2, label: 'Integrante 2' },
                { val: member3, set: setMember3, label: 'Integrante 3' },
              ].map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 flex-shrink-0 rounded-full bg-blue-600 text-white flex items-center justify-center font-black text-xs">{i + 1}</div>
                  <input value={m.val} onChange={e => m.set(e.target.value)} className="flex-1 p-3 md:p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500 transition-all text-sm md:text-base" placeholder={`${m.label} (opcional)`} />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={!teamName || !schoolName || !cap}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-300 text-white font-black py-4 md:py-5 rounded-2xl shadow-2xl shadow-blue-600/30 transition-all flex items-center justify-center gap-3 text-base md:text-lg uppercase tracking-widest mt-2"
          >
            <Icon name="plus" className="w-5 h-5 md:w-6 md:h-6" /> Registrar Equipo
          </button>
        </div>
      </div>
    </>
  );
}

const TeamCardManual = ({ team, onEdit }) => (
    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
            <SchoolLogo schoolName={team.schoolName} size="w-10 h-10" />
            <div className="min-w-0">
                <p className="font-black text-blue-900 uppercase tracking-tight truncate leading-tight">{team.teamName}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mt-0.5">{team.schoolName || 'Institución'}</p>
            </div>
        </div>
        <button 
            onClick={onEdit}
            className="p-3 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 hover:bg-blue-50 transition-all flex-shrink-0 shadow-sm group-hover:shadow-md"
        >
            <Icon name="edit-3" className="w-4 h-4" />
        </button>
    </div>
);


function InspeccionTab({ teams, updateTeamStatus, disqualifyTeam, onUpdateTeamBase, onDeleteTeam }) {
  const [editingTeam, setEditingTeam] = useState(null);
  const pending = teams.filter(t => t.status === 'pending');
  return (
    <div className="max-w-4xl mx-auto animate-fadeIn">
      <h2 className="text-2xl md:text-3xl font-black text-blue-900 mb-6 md:mb-8 uppercase italic leading-tight">Inspección de Hardware</h2>
      
      {/* ROBOTS PENDIENTES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12">
        {pending.length === 0 && (
          <div className="bg-white p-8 md:p-12 rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center opacity-60 col-span-2">
            <Icon name="clipboard-check" className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mb-4" />
            <p className="text-slate-400 font-bold text-lg md:text-xl uppercase tracking-tighter text-center">No hay robots en espera</p>
          </div>
        )}
        {pending.map(t => (
          <div key={t.id} className="bg-white p-5 md:p-6 rounded-[2rem] shadow-xl border border-slate-200">
            <div className="flex justify-between items-start mb-4 md:mb-6">
              <div>
                <h3 className="font-black text-blue-900 text-lg md:text-xl leading-tight">{getTeamDisplayNames(t).team}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{getTeamDisplayNames(t).school}</p>
                <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest border-t border-slate-50 pt-2">👤 {t.captainName}</p>
              </div>
              <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[9px] font-black">ESPERA</div>
            </div>
            <div className="flex gap-2 md:gap-3">
              <button onClick={() => updateTeamStatus(t.id, 'inspected')} className="flex-1 bg-green-500 text-white font-black py-3 md:py-4 rounded-xl text-[10px] uppercase shadow-lg shadow-green-500/20">Aprobar</button>
              <button onClick={() => disqualifyTeam(t.id, 'No cumple requisitos')} className="flex-1 bg-red-50 text-red-600 font-black py-3 md:py-4 rounded-xl text-[10px] uppercase">Rechazar</button>
            </div>
          </div>
        ))}
      </div>

      {/* GESTIÓN DE TODOS LOS EQUIPOS */}
      <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-blue-900 uppercase italic tracking-tighter">Base de Datos de Equipos</h2>
            <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Edición y eliminación de registros</p>
          </div>
          <div className="bg-blue-100 text-blue-600 px-4 py-2 rounded-2xl font-black text-xs md:text-sm flex items-center gap-2">
            <Icon name="users" className="w-4 h-4" />
            {teams.length}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teams.sort((a, b) => a.teamName.localeCompare(b.teamName)).map(team => (
            <TeamCardManual 
                key={team.id} 
                team={team} 
                onEdit={() => setEditingTeam(team)}
            />
          ))}
        </div>
      </div>

      {editingTeam && (
          <EditTeamModal 
              team={editingTeam} 
              onClose={() => setEditingTeam(null)} 
              onSave={(name, school) => {
                  onUpdateTeamBase(editingTeam.id, name, school);
                  setEditingTeam(null);
              }} 
              onDelete={() => {
                  setEditingTeam(null);
                  onDeleteTeam(editingTeam.id);
              }}
          />
      )}
    </div>
  );
}

function EditTeamModal({ team, onClose, onSave, onDelete }) {
    const [name, setName] = useState(team.teamName || '');
    const [school, setSchool] = useState(team.schoolName || '');

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl p-8 transform animate-fadeIn border-2 border-blue-500">
                <h3 className="text-xl font-black text-center uppercase text-slate-800 mb-6">Editar Equipo</h3>
                
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Nombre del Equipo</label>
                        <input value={name} onChange={e => setName(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Institución / Colegio</label>
                        <input value={school} onChange={e => setSchool(e.target.value)} className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                </div>

                <div className="flex gap-2 mb-4">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-500 font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                    <button onClick={() => onSave(name, school)} className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-black text-xs uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/30">Guardar</button>
                </div>
                
                {onDelete && (
                    <div className="border-t border-slate-200 pt-4 mt-2">
                        <button onClick={onDelete} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-black text-xs uppercase hover:bg-red-500 hover:text-white transition-all border border-red-100 flex items-center justify-center gap-2 shadow-sm">
                            <Icon name="trash-2" className="w-4 h-4"/> Eliminar Permanentemente
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// Mapa de palabras clave para encontrar el logo correcto según el nombre del colegio
const SCHOOL_LOGO_MAP = [
    { keywords: ['juan vicente', 'jvg'],              file: '1-Juan_Vicente_González.jpg' },
    { keywords: ['menca'],                            file: '2-UE_Menca.png'              },
    { keywords: ['la paz', 'paz'],                    file: '3-U.E_La Paz.png'            },
    { keywords: ['ideal'],                            file: '4-Colegio Ideal.PNG'         },
    { keywords: ['abajo cadenas', 'cadenas'],         file: '5-Abajo_Cadenas.png'         },
    { keywords: ['raul leoni', 'raúl leoni'],         file: '6-Raul Leoni.png'            },
    { keywords: ['eduardo blanco', 'blanco'],         file: '7-Colegio_Eduardo_Blanco.png'},
    { keywords: ['cacica', 'urimare'],                file: '8-Cacica_Urimare.png'        },
    { keywords: ['nueva barcelona', 'barcelona'],     file: '9-Nueva-Barcelona.jpg'       },
    { keywords: ['don bosco', 'bosco'],               file: '10-Don-Bosco.png'            },
];

const getSchoolLogoFile = (name) => {
    if (!name) return null;
    const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const match = SCHOOL_LOGO_MAP.find(entry =>
        entry.keywords.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    );
    return match ? `/logos/${match.file}` : null;
};

const SchoolLogo = ({ schoolName, size = "w-8 h-8" }) => {
    const initials = schoolName ? schoolName.split(' ').filter(w => w.length > 2).map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';
    const [hasError, setHasError] = useState(false);
    
    // Colores estables basados en el nombre (solo para el fallback de iniciales)
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500', 'bg-indigo-500'];
    const colorIdx = schoolName ? schoolName.length % colors.length : 0;
    const bgColor = colors[colorIdx] || 'bg-slate-700';

    const logoPath = getSchoolLogoFile(schoolName);

    return (
        <div className={`${size} rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white border-2 border-slate-100 shadow-sm p-1`}>
            {!hasError && logoPath ? (
                <img 
                    src={logoPath} 
                    alt="" 
                    className="w-full h-full object-contain"
                    onError={() => setHasError(true)}
                />
            ) : (
                <div className={`w-full h-full ${bgColor} rounded-lg flex items-center justify-center text-white font-black text-[10px]`}>
                    <span>{initials}</span>
                </div>
            )}
        </div>
    );
};

function ResultadosTab({ teams, currentUser, onShowHistory }) {
  const [selRondaView, setSelRondaView] = useState('global');

  const getRoundStats = (team, roundFilter) => {
    const rh = team.history.filter(h => h.ronda === Number(roundFilter) && h.practice !== true);
    let totalScore = 0;
    let totalTime = 0;

    if (roundFilter === 'global') {
        totalScore = team.score || 0;
        totalTime = team.lastTime || 0;
    } else if (rh.length === 0) {
        return { score: 0, time: 999999 };
    } else {
        // Calcular puntaje acumulado para la ronda seleccionada (todas las categorías)
        totalScore = rh.reduce((sum, h) => sum + (h.points || h.percentage || 0), 0);
        
        if (team.category === 'line_follower') {
            const pista5 = rh.find(h => h.pista === 5);
            // Si terminó pista 5, usamos ese tiempo. Si no terminó pista 5, usamos tiempo máximo (30 min)
            totalTime = pista5 ? (pista5.finalTimeMs || 0) : 1800000;
        } else {
            // Para Quest, sumamos los tiempos de las pistas registradas
            totalTime = rh.reduce((sum, h) => sum + (h.finalTimeMs || h.finalTime || 0), 0);
        }
    }
    return { score: totalScore, time: totalTime };
  };

  const sorted = useMemo(() => {
    let list = Array.isArray(teams) ? teams : [];
    
    // Filtrar equipos por calificación de ronda si no estamos en vista global
    if (selRondaView !== 'global') {
        list = list.filter(t => (t.qualifiedRounds || [1]).includes(Number(selRondaView)));
    }

    return [...list].sort((a, b) => {
        const statsA = getRoundStats(a, selRondaView);
        const statsB = getRoundStats(b, selRondaView);
        if (statsB.score !== statsA.score) return statsB.score - statsA.score;
        return statsA.time - statsB.time;
    });
  }, [teams, selRondaView]);

  const formatResultTime = (ms) => {
    if (!ms || ms === 999999) return "--:--.--";
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const msecs = Math.floor((ms % 1000) / 10);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-200 gap-4">
          <h2 className="text-2xl md:text-3xl font-black text-blue-900 tracking-tighter uppercase italic leading-tight">Ranking Oficial</h2>
          <select value={selRondaView} onChange={e => setSelRondaView(e.target.value)} className="w-full sm:w-auto bg-blue-50 border-2 border-blue-100 text-blue-900 font-bold px-4 py-2 rounded-xl focus:outline-none focus:border-blue-400 text-sm md:text-base">
              <option value="global">Ranking Global Acumulado</option>
              {[1,2,3,4,5].map(r => <option key={r} value={r}>Desempeño Ronda {r}</option>)}
          </select>
      </div>
      <div className="bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px] md:min-w-0">
            <thead className="bg-blue-600 text-white">
              <tr>
                <th className="p-4 md:p-6 text-[9px] md:text-[10px] uppercase w-16 md:w-24 text-center">Pos</th>
                <th className="p-4 md:p-6 text-[9px] md:text-[10px] uppercase">Institución</th>
                <th className="p-4 md:p-6 text-[9px] md:text-[10px] uppercase text-center hidden sm:table-cell">Estado</th>
                <th className="p-4 md:p-6 text-[9px] md:text-[10px] uppercase text-right">Puntaje / Tiempo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((t, i) => {
                const stats = getRoundStats(t, selRondaView);
                // Lógica de colores por posición
                let posColor = "text-blue-900";
                let posBg = "bg-transparent";
                if (i === 0 && stats.score > 0) { posColor = "text-yellow-600"; posBg = "bg-yellow-100/50"; }
                else if (i === 1 && stats.score > 0) { posColor = "text-slate-500"; posBg = "bg-slate-100"; }
                else if (i === 2 && stats.score > 0) { posColor = "text-orange-700"; posBg = "bg-orange-50/50"; }

                return (
                <tr 
                  key={t.id} 
                  onClick={() => currentUser.role === 'admin' && onShowHistory(t.id)}
                  className={`${t.status === 'disqualified' ? 'bg-red-50 opacity-50' : 'hover:bg-blue-50'} ${currentUser.role === 'admin' ? 'cursor-pointer transition-colors' : ''} ${posBg}`}
                >
                  <td className={`p-4 md:p-6 text-center font-black text-xl md:text-2xl ${posColor}`}>
                    {i === 0 ? '🏆 1' : i === 1 ? '🥈 2' : i === 2 ? '🥉 3' : i + 1}
                  </td>
                  <td className="p-4 md:p-6">
                      <div className="flex items-center gap-3">
                          <SchoolLogo schoolName={t.schoolName} size="w-10 h-10 md:w-12 md:h-12" />
                          <div className="min-w-0">
                              <p className={`font-black text-base md:text-xl leading-tight ${posColor}`}>{t.teamName}</p>
                              <p className="text-[9px] md:text-xs text-slate-400 font-bold uppercase tracking-widest leading-tight mt-1 truncate">{t.schoolName || 'Institución Independiente'}</p>
                              <p className="hidden md:block text-[9px] text-slate-300 font-bold mt-1 uppercase tracking-tight">👤 {t.captainName}</p>
                          </div>
                      </div>
                  </td>
                  <td className="p-4 md:p-6 text-center hidden sm:table-cell">
                      <span className={`text-[8px] md:text-[9px] font-black px-3 md:px-4 py-1 md:py-1.5 rounded-full border ${t.status === 'disqualified' ? 'border-red-200 text-red-600 bg-red-50' : 'border-green-200 text-green-600 bg-green-50'}`}>
                          {t.status.toUpperCase()}
                      </span>
                  </td>
                  <td className="p-4 md:p-6 text-right">
                      <div className="flex flex-col items-end">
                          <span className={`text-2xl md:text-4xl font-black tracking-tighter ${posColor}`}>{stats.score}</span>
                          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase leading-none mt-1">{formatResultTime(stats.time)}</p>
                      </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function LineFollowerEvaluacion({ teams, addScore, currentUser, disqualifyTeam, postTeams, showToast, selRonda }) {
  const [selTeam, setSelTeam] = useState('');
  const [percentage, setPercentage] = useState(0);
  const [time, setTime] = useState(120000); // 2 min en ms
  const [running, setRunning] = useState(false);
  const [penalties, setPenalties] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const activeTeams = teams.filter(t => t.status === 'inspected' && (t.qualifiedRounds || [1]).includes(selRonda));

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
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-fadeIn">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-xl md:text-2xl font-black text-blue-900 mb-6 md:mb-8 uppercase italic flex items-center gap-3">
            <Icon name="play-circle" className="text-blue-600 w-6 h-6 md:w-8 md:h-8" /> Mesa del Juez
        </h2>
        
        <div className="space-y-5 md:space-y-6">
          <div>
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-2">Robot en Pista</label>
            <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="w-full p-3 md:p-4 rounded-2xl bg-blue-50/50 border-2 border-blue-100 font-bold outline-none focus:border-blue-500 transition-all text-blue-900 text-sm md:text-base">
              <option value="">-- Seleccionar Equipo --</option>
              {activeTeams.map(t => <option key={t.id} value={t.id}>{t.school}</option>)}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-end mb-4">
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Porcentaje de Recorrido</label>
                <span className="text-3xl md:text-4xl font-black text-blue-600 tracking-tighter">{percentage}%</span>
            </div>
            <input type="range" min="0" max="100" value={percentage} onChange={e => setPercentage(parseInt(e.target.value))} className="w-full h-3 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
            <div className="flex justify-between mt-2 text-[9px] md:text-[10px] font-bold text-slate-300">
                <span>INICIO (0%)</span><span>PROGRESO</span><span>META (100%)</span>
            </div>
          </div>

          <div className="pt-5 md:pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 md:gap-4">
              <button 
                onClick={() => setPenalties(p => p + 1)}
                className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-600 p-4 rounded-2xl border-2 border-orange-100 font-black text-[10px] md:text-xs flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 transition-all"
              >
                  <Icon name="alert-triangle" className="w-4 h-4" /> 
                  <span className="flex-1 sm:flex-none">Penalización (+5s)</span>
                  <span className="bg-orange-500 text-white px-2.5 py-1 rounded-full text-[10px]">{penalties}</span>
              </button>
              <button 
                onClick={() => { setPercentage(0); handleReset(); }}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 p-4 rounded-2xl border-2 border-red-100 font-black text-[10px] md:text-xs flex flex-row sm:flex-col items-center justify-center gap-3 sm:gap-1 transition-all"
              >
                  <Icon name="ban" className="w-4 h-4" /> 
                  <span className="flex-1 sm:flex-none">Intento Nulo</span>
              </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 md:gap-6">
        <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border-4 border-slate-800 text-center flex-1 flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-1 bg-blue-600 group-hover:bg-blue-400 transition-colors"></div>
            <p className="text-[9px] md:text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] md:tracking-[0.4em] mb-3 md:mb-4 leading-none">Temporizador (2:00 Limite)</p>
            <div className={`text-5xl md:text-6xl font-black font-mono tracking-widest mb-8 md:mb-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-colors ${time < 10000 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                {formatStopwatch(time)}
            </div>
            <div className="flex gap-3 md:gap-4 justify-center">
                {!running ? (
                    <button onClick={handleStart} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white px-6 md:px-10 py-4 md:py-5 rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2">
                        <Icon name="play-circle" className="w-4 h-4 md:w-5 md:h-5" /> Iniciar
                    </button>
                ) : (
                    <button onClick={handlePause} className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white px-6 md:px-10 py-4 md:py-5 rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-2">
                        <Icon name="pause" className="w-4 h-4 md:w-5 md:h-5" /> Pausar
                    </button>
                )}
                <button onClick={handleReset} className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-white px-6 md:px-10 py-4 md:py-5 rounded-2xl font-black uppercase text-[10px] md:text-xs transition-all">Reiniciar</button>
            </div>
        </div>

        <button 
           onClick={handleSave}
           disabled={!selTeam}
           className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-200 text-white font-black py-5 md:py-6 rounded-[1.5rem] md:rounded-3xl shadow-2xl shadow-green-500/30 text-lg md:text-xl uppercase tracking-[0.1em] md:tracking-[0.2em] transition-all hover:scale-[1.01] active:scale-95"
        >
            Guardar Resultado
        </button>
      </div>
    </div>
  );
}

function CompetitionDualOverlay({ teams, questTimer, questTimerActive, toggleQuestTimer, resetQuestTimer, questDuration, lineTimer, lineTimerActive, toggleLineTimer, resetLineTimer, lineDuration, formatTime, onExit, suspenseMode }) {
    const [allTeams, setAllTeams] = useState(teams);
    const [selRondaView, setSelRondaView] = useState('global');
    const [shuffleSeed, setShuffleSeed] = useState(0);
    const [isShuffling, setIsShuffling] = useState(false);
    
    const questListRef = useRef(null);
    const lineListRef = useRef(null);
    const prevPositions = useRef({});

    // Técnica FLIP para animaciones suaves
    useLayoutEffect(() => {
        const refs = [questListRef, lineListRef];
        refs.forEach(ref => {
            if (!ref.current) return;
            const cards = ref.current.children;
            for (let card of cards) {
                const id = card.getAttribute('data-id');
                const rect = card.getBoundingClientRect();
                
                if (prevPositions.current[id]) {
                    const delta = prevPositions.current[id] - rect.top;
                    if (delta !== 0) {
                        card.style.transition = 'none';
                        card.style.transform = `translateY(${delta}px) scale(1.02)`;
                        
                        requestAnimationFrame(() => {
                            card.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease';
                            card.style.transform = 'translateY(0) scale(1)';
                        });
                    }
                }
                prevPositions.current[id] = rect.top;
            }
        });
    }); // Se ejecuta en cada renderizado para capturar cambios de posición

    // Efecto para barajar periódicamente con tiempo aleatorio (15s - 25s)
    useEffect(() => {
        let timeoutId;
        const programarSiguiente = () => {
            if (!suspenseMode) return;
            
            const delay = Math.floor(Math.random() * (25000 - 15000 + 1)) + 15000;
            
            timeoutId = setTimeout(() => {
                setIsShuffling(true);
                setShuffleSeed(s => s + 1);
                setTimeout(() => setIsShuffling(false), 800);
                programarSiguiente();
            }, delay);
        };

        if (suspenseMode) {
            programarSiguiente();
        } else {
            setShuffleSeed(0);
            setIsShuffling(false);
        }
        
        return () => clearTimeout(timeoutId);
    }, [suspenseMode]);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const res = await fetch(`${API_BASE}/data`);
                const data = await res.json();
                if (data.teams) setAllTeams(data.teams);
            } catch (err) { console.error("Dual TV fetch error:", err); }
        };
        fetchAll();
        const interval = setInterval(fetchAll, 5000);
        return () => clearTimeout(interval);
    }, []);

    const getRoundStats = (team, roundFilter, cat) => {
        if (roundFilter === 'global') return { score: team.score || 0, time: team.lastTime || 9999999 };
        const rd = parseInt(roundFilter);
        const rh = Array.isArray(team.history) ? team.history.filter(h => h.ronda === rd && h.practice !== true) : [];
        if (rh.length === 0) return { score: 0, time: 9999999 };
        
        let totalScore = rh.reduce((sum, h) => sum + (h.points || h.percentage || 0), 0);
        let totalTime = 0;
        
        if (cat === 'quest') {
            const pista5 = rh.find(h => h.pista === 5);
            totalTime = pista5 ? (pista5.finalTimeMs || 0) : (questDuration * 60 * 1000);
        } else {
            totalTime = rh.reduce((sum, h) => sum + (h.finalTimeMs || h.finalTime || 0), 0);
            if (totalTime === 0) totalTime = (lineDuration * 60 * 1000);
        }
        return { score: totalScore, time: totalTime };
    };

    const getSorted = (cat) => {
        const list = Array.isArray(allTeams) ? allTeams.filter(t => t.category === cat) : [];
        
        // Filtrar por calificados si no es global
        const filtered = selRondaView === 'global' ? list : list.filter(t => (t.qualifiedRounds || [1]).includes(parseInt(selRondaView)));

        if (suspenseMode) {
            // Fisher-Yates Shuffle con generador pseudo-aleatorio basado en seed
            let result = [...filtered];
            const pseudoRandom = (s) => {
                let x = Math.sin(s + shuffleSeed) * 10000;
                return x - Math.floor(x);
            };
            
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(pseudoRandom(i + (cat === 'quest' ? 100 : 200)) * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        }

        return [...filtered].sort((a, b) => {
            const sA = getRoundStats(a, selRondaView, cat);
            const sB = getRoundStats(b, selRondaView, cat);
            if (sB.score !== sA.score) return sB.score - sA.score;
            return sA.time - sB.time;
        });
    };

    const questTeams = getSorted('quest');
    const followerTeams = getSorted('line_follower');

    const formatResultTime = (ms) => {
        if (!ms || ms === 999999) return "--:--.--";
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const msecs = Math.floor((ms % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${msecs.toString().padStart(2, '0')}`;
    };

    const TeamRow = ({ team, index, cat }) => {
        const stats = getRoundStats(team, selRondaView, cat);
        let posColorText = "text-blue-400", posBg = "bg-slate-900/40 border-slate-800/50", posBadge = "";
        
        // Solo resaltar si NO estamos en modo suspenso
        if (!suspenseMode) {
            if (index === 0 && stats.score > 0) { posColorText = "text-yellow-400"; posBg = "bg-yellow-600/10 border-yellow-500/30"; posBadge = "🏆"; }
            else if (index === 1 && stats.score > 0) { posColorText = "text-slate-300"; posBg = "bg-slate-400/10 border-slate-400/20"; posBadge = "🥈"; }
            else if (index === 2 && stats.score > 0) { posColorText = "text-orange-400"; posBg = "bg-orange-600/10 border-orange-500/20"; posBadge = "🥉"; }
        }

        return (
            <div 
                data-id={team.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${posBg} ${team.status === 'disqualified' ? 'opacity-30' : ''} ${isShuffling ? 'shadow-2xl border-orange-500/50' : 'shadow-md'} hover:scale-[1.02] active:scale-95`}
            >
                <div className="w-10 text-center flex-shrink-0">
                    <span className={`text-xl font-black italic ${posColorText}`}>{suspenseMode ? '??' : `#${index + 1}`}</span>
                    <div className="text-[10px]">{suspenseMode ? '🔒' : posBadge}</div>
                </div>
                <SchoolLogo schoolName={team.schoolName} size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black truncate text-white leading-tight uppercase italic">{team.teamName}</p>
                    <p className="text-[9px] text-slate-400 truncate font-bold uppercase tracking-tight">{team.schoolName || 'Institución Independiente'}</p>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col justify-center">
                    <p className={`text-2xl font-black ${posColorText} leading-none`}>{suspenseMode ? '???' : stats.score}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 leading-none">{suspenseMode ? '--:--.--' : formatResultTime(stats.time)}</p>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col overflow-hidden animate-fadeIn font-sans">
            {/* Header */}
            <div className="flex justify-between items-center px-8 py-4 border-b border-slate-800 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30">
                        <Icon name="layout" className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black italic tracking-tighter uppercase">Ranking Dual en Vivo</h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
                            Sincronizado en tiempo real · ADAGAMES V4.5
                            {suspenseMode && (
                                <span className="ml-4 flex items-center gap-1.5 bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/30 text-orange-400 animate-pulse">
                                    <span className="w-1 h-1 rounded-full bg-orange-500"></span>
                                    MODO SUSPENSO ACTIVO
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
                        <button 
                            onClick={() => setSelRondaView('global')} 
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${selRondaView === 'global' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Global
                        </button>
                        {[1,2,3,4,5].map(r => (
                            <button 
                                key={r}
                                onClick={() => setSelRondaView(r.toString())} 
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${selRondaView === r.toString() ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                R{r}
                            </button>
                        ))}
                    </div>
                    <button onClick={onExit} className="px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 border border-red-500/20">
                        <Icon name="log-out" className="w-4 h-4" /> Salir TV
                    </button>
                </div>
            </div>

            {/* Dual Panels */}
            <div className="flex flex-1 overflow-hidden">
                {/* Quest Panel */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="bg-blue-900/40 border-b-4 border-blue-600 p-6 flex flex-col items-center justify-center flex-shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-blue-500"></div>
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-blue-400 flex items-center gap-3 mb-4 drop-shadow-md">
                            <Icon name="trophy" className="w-8 h-8" /> Robotics Quest
                        </h2>
                        
                        <div className={`px-12 py-3 rounded-[2rem] border-4 transition-all duration-500 shadow-2xl flex flex-col items-center justify-center bg-slate-950 ${questTimer < 300 ? 'border-red-500 bg-red-950/30 animate-pulse' : 'border-blue-500/30'}`}>
                            <p className={`text-6xl md:text-7xl font-black font-mono tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] ${questTimer < 300 ? 'text-red-500' : 'text-white'}`}>
                                {formatTime(questTimer)}
                            </p>
                        </div>
                        
                        <div className="flex gap-3 mt-5">
                            <button onClick={toggleQuestTimer} className={`px-6 py-2 rounded-xl font-black text-xs uppercase shadow-xl transition-all ${questTimerActive ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/30' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'}`}>
                                {questTimerActive ? 'Pausar' : 'Iniciar'}
                            </button>
                            <button onClick={resetQuestTimer} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-xs uppercase text-slate-300 transition-all">Reset</button>
                        </div>
                        <p className="text-[10px] text-blue-400/50 uppercase tracking-widest mt-4 font-bold">{questTeams.length} equipos en ranking</p>
                    </div>
                    <div ref={questListRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {questTeams.length === 0 ? (
                            <p className="text-slate-500 text-center mt-8 font-bold italic opacity-50 uppercase tracking-widest text-[10px]">Sin equipos en esta fase</p>
                        ) : questTeams.map((t, i) => <TeamRow key={t.id} team={t} index={i} cat="quest" />)}
                    </div>
                </div>

                {/* Racing Separator */}
                <div className="relative w-16 flex-shrink-0 flex flex-col items-center justify-center bg-slate-950 overflow-hidden">
                    {/* Animated racing line */}
                    <div className="absolute inset-0 flex flex-col items-center">
                        <div className="w-0.5 h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent animate-pulse"></div>
                    </div>
                    {/* Racing cars animation */}
                    <div className="relative z-10 flex flex-col items-center gap-3">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="text-lg" style={{
                                animation: `racingCar ${1.5 + i * 0.3}s linear infinite`,
                                animationDelay: `${i * 0.2}s`,
                                opacity: 0.6 + (i % 3) * 0.15
                            }}>
                                {i % 3 === 0 ? '🏎️' : i % 3 === 1 ? '🤖' : '⚡'}
                            </div>
                        ))}
                    </div>
                    <style>{`
                        @keyframes racingCar {
                            0% { transform: translateY(-60px); opacity: 0; }
                            10% { opacity: 1; }
                            90% { opacity: 1; }
                            100% { transform: translateY(60px); opacity: 0; }
                        }
                    `}</style>
                    {/* ADA label */}
                    <div className="w-0.5 h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent"></div>
                    <div className="absolute bottom-4 text-[8px] font-black text-purple-400 tracking-widest" style={{writingMode:'vertical-rl'}}>ADA GAMES</div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="bg-emerald-900/40 border-b-4 border-emerald-600 p-6 flex flex-col items-center justify-center flex-shrink-0 relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-1 bg-emerald-500"></div>
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-emerald-400 flex items-center gap-3 mb-4 drop-shadow-md">
                            <Icon name="zap" className="w-8 h-8" /> Sigue Líneas
                        </h2>
                        
                        <div className={`px-12 py-3 rounded-[2rem] border-4 transition-all duration-500 shadow-2xl flex flex-col items-center justify-center bg-slate-950 ${lineTimer < 300 ? 'border-red-500 bg-red-950/30 animate-pulse' : 'border-emerald-500/30'}`}>
                            <p className={`text-6xl md:text-7xl font-black font-mono tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] ${lineTimer < 300 ? 'text-red-500' : 'text-white'}`}>
                                {formatTime(lineTimer)}
                            </p>
                        </div>
                        
                        <div className="flex gap-3 mt-5">
                            <button onClick={toggleLineTimer} className={`px-6 py-2 rounded-xl font-black text-xs uppercase shadow-xl transition-all ${lineTimerActive ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/30' : 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30'}`}>
                                {lineTimerActive ? 'Pausar' : 'Iniciar'}
                            </button>
                            <button onClick={resetLineTimer} className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-xs uppercase text-slate-300 transition-all">Reset</button>
                        </div>
                        <p className="text-[10px] text-emerald-400/50 uppercase tracking-widest mt-4 font-bold">{followerTeams.length} equipos en ranking</p>
                    </div>
                    <div ref={lineListRef} className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        {followerTeams.length === 0 ? (
                            <p className="text-slate-500 text-center mt-8 font-bold italic opacity-50 uppercase tracking-widest text-[10px]">Sin equipos en esta fase</p>
                        ) : followerTeams.map((t, i) => <TeamRow key={t.id} team={t} index={i} cat="line_follower" />)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function CompetitionOverlay({ teams, questTimer, questTimerActive, toggleQuestTimer, resetQuestTimer, questDuration, lineTimer, lineTimerActive, toggleLineTimer, resetLineTimer, lineDuration, formatTime, onExit, initialCategory, suspenseMode }) {
    const [viewCategory, setViewCategory] = useState(initialCategory);
    const [vTeams, setVTeams] = useState(teams);
    const [selRondaView, setSelRondaView] = useState('global');
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [shuffleSeed, setShuffleSeed] = useState(0);
    const [isShuffling, setIsShuffling] = useState(false);
    
    const listRef = useRef(null);
    const prevPositions = useRef({});

    // Técnica FLIP para animaciones suaves
    useLayoutEffect(() => {
        if (!listRef.current) return;
        const cards = listRef.current.children;
        for (let card of cards) {
            const id = card.getAttribute('data-id');
            const rect = card.getBoundingClientRect();
            
            if (prevPositions.current[id]) {
                const delta = prevPositions.current[id] - rect.top;
                if (delta !== 0) {
                    card.style.transition = 'none';
                    card.style.transform = `translateY(${delta}px) scale(1.03)`;
                    
                    requestAnimationFrame(() => {
                        card.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease, opacity 0.4s ease';
                        card.style.transform = 'translateY(0) scale(1)';
                    });
                }
            }
            prevPositions.current[id] = rect.top;
        }
    }); // Se ejecuta en cada renderizado para capturar cambios de posición

    // Efecto para barajar periódicamente con tiempo aleatorio (15s - 25s)
    useEffect(() => {
        let timeoutId;
        const programarSiguiente = () => {
            if (!suspenseMode) return;
            const delay = Math.floor(Math.random() * (25000 - 15000 + 1)) + 15000;
            timeoutId = setTimeout(() => {
                setIsShuffling(true);
                setShuffleSeed(s => s + 1);
                setTimeout(() => setIsShuffling(false), 800);
                programarSiguiente();
            }, delay);
        };
        if (suspenseMode) {
            programarSiguiente();
        } else {
            setShuffleSeed(0);
            setIsShuffling(false);
        }
        return () => clearTimeout(timeoutId);
    }, [suspenseMode]);

    // Sincronizar viewCategory si el prop initialCategory cambia (por el "slicer" de la sidebar)
    useEffect(() => {
        setViewCategory(initialCategory);
    }, [initialCategory]);
    const scrollDirection = useRef(1);
    const exactScroll = useRef(0);

    // Polling específico para la categoría en pantalla
    useEffect(() => {
        const fetchCategoryData = async () => {
            try {
                const res = await fetch(`${API_BASE}/data?category=${viewCategory}`);
                const data = await res.json();
                if (data.teams) setVTeams(data.teams);
            } catch (err) {
                console.error("Error fetching category data for TV:", err);
            }
        };

        fetchCategoryData();
        const interval = setInterval(fetchCategoryData, 5000);
        return () => clearInterval(interval);
    }, [viewCategory]);

    useEffect(() => {
        let animationFrameId;
        const scrollStep = () => {
            if (!listRef.current || !isAutoScrolling) return;
            const el = listRef.current;
            
            // Sincronizar posición por si el usuario hizo scroll manual
            if (Math.abs(exactScroll.current - el.scrollTop) > 5) {
                exactScroll.current = el.scrollTop;
            }

            exactScroll.current += scrollDirection.current * 0.5;
            el.scrollTop = exactScroll.current;
            
            // Rebote en el fondo de la lista con margen de seguridad (evita bugs de pixeles fraccionales en Chromium)
            if (scrollDirection.current === 1 && (el.scrollTop + el.clientHeight) >= el.scrollHeight - 2) {
                scrollDirection.current = -1;
            } 
            // Rebote en el tope de la lista
            else if (scrollDirection.current === -1 && el.scrollTop <= 0) {
                scrollDirection.current = 1;
            }
            
            animationFrameId = requestAnimationFrame(scrollStep);
        };
        
        if (isAutoScrolling) {
            animationFrameId = requestAnimationFrame(scrollStep);
        }
        
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [isAutoScrolling]);

    const getRoundStats = (team, roundFilter) => {
        if (roundFilter === 'global') return { score: team.score || 0, time: team.lastTime || 9999999 };
        const rd = parseInt(roundFilter);
        const rh = Array.isArray(team.history) ? team.history.filter(h => h.ronda === rd) : [];
        if (rh.length === 0) return { score: 0, time: 9999999 };
        
        let totalScore = rh.reduce((sum, h) => sum + (h.points || h.percentage || 0), 0);
        let totalTime = 0;
        
        if (viewCategory === 'quest') {
            const pista5 = rh.find(h => h.pista === 5);
            // Si no ha terminado la ronda, el tiempo de fallback es la duración total de la ronda
            totalTime = pista5 ? (pista5.finalTimeMs || 0) : (questDuration * 60 * 1000);
        } else {
            totalTime = rh.reduce((sum, h) => sum + (h.finalTimeMs || h.finalTime || 0), 0);
            if (totalTime === 0) totalTime = (lineDuration * 60 * 1000);
        }

        return { score: totalScore, time: totalTime };
    };

    const sorted = useMemo(() => {
        const list = Array.isArray(vTeams) ? vTeams : [];
        
        if (suspenseMode) {
            // Fisher-Yates Shuffle con generador pseudo-aleatorio basado en seed
            let result = [...list];
            const pseudoRandom = (s) => {
                let x = Math.sin(s + shuffleSeed + (viewCategory === 'quest' ? 500 : 600)) * 10000;
                return x - Math.floor(x);
            };
            
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(pseudoRandom(i) * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        }

        return [...list].sort((a, b) => {
            const statsA = getRoundStats(a, selRondaView);
            const statsB = getRoundStats(b, selRondaView);
            if (statsB.score !== statsA.score) return statsB.score - statsA.score;
            return statsA.time - statsB.time;
        });
    }, [vTeams, selRondaView, viewCategory, suspenseMode, shuffleSeed]);

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
                        <div className="flex gap-4 items-center mt-3">
                            <div className="flex bg-slate-900/80 p-1 rounded-2xl border border-slate-800 shadow-2xl">
                                <button 
                                    onClick={() => setViewCategory('quest')}
                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewCategory === 'quest' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Robotics Quest
                                </button>
                                <button 
                                    onClick={() => setViewCategory('line_follower')}
                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${viewCategory === 'line_follower' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Seguidores Línea
                                </button>
                            </div>
                            <span className="text-blue-500/50 font-black">|</span>
                            <p className="text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                                {viewCategory === 'line_follower' ? 'Seguidor de Línea' : 'Robotics Quest'}
                            </p>
                            {suspenseMode && (
                                <div className="flex items-center gap-2 bg-orange-500/20 px-3 py-1 rounded-full border border-orange-500/30 animate-pulse ml-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                    <span className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Modo Suspenso Activo</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setSelRondaView('global')} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-lg ${selRondaView === 'global' ? 'bg-blue-600 text-white shadow-blue-600/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Global</button>
                            {[1,2,3,4,5].map(r => (
                                <button key={r} onClick={() => setSelRondaView(r.toString())} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all shadow-lg ${selRondaView === r.toString() ? 'bg-blue-600 text-white shadow-blue-600/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>R{r}</button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-4">
                    {/* Timer dinámico según categoría seleccionada */}
                    <div className={`p-8 rounded-[2.5rem] border-4 transition-all duration-500 shadow-2xl ${
                        (viewCategory === 'quest' ? questTimer : lineTimer) < 300 
                        ? 'bg-red-500/20 border-red-500 animate-pulse' 
                        : 'bg-slate-900 border-blue-500/30'
                    }`}>
                        <p className="text-[10px] font-black text-center uppercase tracking-widest mb-1 text-slate-400">
                            Tiempo: {viewCategory === 'quest' ? 'Robotics Quest' : 'Sigue Líneas'}
                        </p>
                        <p className="text-7xl font-black font-mono tracking-widest text-white">
                            {formatTime(viewCategory === 'quest' ? questTimer : lineTimer)}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={viewCategory === 'quest' ? toggleQuestTimer : toggleLineTimer} 
                            className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${
                                (viewCategory === 'quest' ? questTimerActive : lineTimerActive) 
                                ? 'bg-orange-500 hover:bg-orange-600' 
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            {(viewCategory === 'quest' ? questTimerActive : lineTimerActive) ? 'Pausar' : 'Iniciar'}
                        </button>
                        <button 
                            onClick={viewCategory === 'quest' ? resetQuestTimer : resetLineTimer} 
                            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-black text-[10px] uppercase"
                        >
                            Reiniciar
                        </button>
                        <button onClick={() => setIsAutoScrolling(!isAutoScrolling)} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isAutoScrolling ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                            <Icon name="chevron-down" className={`w-3 h-3 ${isAutoScrolling ? 'animate-bounce' : ''}`} /> {isAutoScrolling ? 'Detener Scroll' : 'Auto Scroll'}
                        </button>
                        <button onClick={onExit} className="px-6 py-3 bg-slate-100/10 hover:bg-white hover:text-slate-900 rounded-xl font-black text-[10px] uppercase transition-all">Salir TV</button>
                    </div>
                </div>
            </div>

            <div ref={listRef} className="flex-1 grid grid-cols-1 gap-4 overflow-y-auto pr-4 custom-scrollbar">
                {sorted.map((t, i) => {
                    const stats = getRoundStats(t, selRondaView);
                    
                    // Sistema Dinámico de Colores de Posición
                    let posColorText = "text-blue-400";
                    let posBg = "bg-slate-900/50 border-slate-800";
                    let posBadge = "";
                    
                    // Solo aplicar resaltado si NO estamos en modo suspenso
                    if (!suspenseMode) {
                        if (i === 0 && stats.score > 0) { 
                            posColorText = "text-yellow-400"; 
                            posBg = "bg-yellow-600/20 border-yellow-500/50 shadow-[0_0_30px_rgba(202,138,4,0.15)] transform scale-[1.02] z-10"; 
                            posBadge = "🏆 LÍDER ORO"; 
                        }
                        else if (i === 1 && stats.score > 0) { 
                            posColorText = "text-slate-300"; 
                            posBg = "bg-slate-400/10 border-slate-400/30 transform scale-[1.01]"; 
                            posBadge = "🥈 PLATA"; 
                        }
                        else if (i === 2 && stats.score > 0) { 
                            posColorText = "text-orange-400"; 
                            posBg = "bg-orange-600/10 border-orange-500/30 transform scale-[1.01]"; 
                            posBadge = "🥉 BRONCE"; 
                        }
                    }

                    return (
                    <div 
                        key={t.id} 
                        data-id={t.id}
                        className={`flex items-center gap-6 p-6 rounded-[2.5rem] border-2 transition-all ${posBg} ${t.status === 'disqualified' ? 'opacity-30' : ''} ${isShuffling ? 'shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-orange-500/30' : 'shadow-xl'} hover:scale-[1.01]`}
                    >
                        <div className="w-24 text-center flex flex-col items-center">
                            <span className={`text-5xl font-black italic ${posColorText}`}>{suspenseMode ? '??' : `#${i + 1}`}</span>
                            <span className={`text-[10px] font-bold mt-2 uppercase tracking-widest ${posColorText}`}>{suspenseMode ? 'BLOQUEADO' : posBadge}</span>
                        </div>
                        <SchoolLogo schoolName={t.schoolName} size="w-20 h-20 md:w-24 md:h-24 shadow-xl" />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-4xl font-black truncate tracking-tight text-white uppercase italic">{t.teamName}</h3>
                            <p className="text-lg font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                                {t.schoolName || 'Institución Independiente'}
                            </p>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 flex items-center gap-2">
                                <Icon name="users" className="w-4 h-4"/> {t.captainName}
                            </p>
                        </div>
                        <div className="bg-slate-950/50 px-10 py-6 rounded-3xl border border-slate-800/50 flex flex-col items-end justify-center min-w-[250px] shadow-inner">
                             <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{suspenseMode ? 'Puntaje Oculto' : 'Puntaje Total'}</p>
                             <p className={`text-6xl font-black tracking-tighter ${posColorText}`}>{suspenseMode ? '???' : stats.score}</p>
                             <p className="text-lg font-bold text-slate-400 mt-2 tracking-widest leading-none drop-shadow-md">{suspenseMode ? '--:--.--' : formatResultTime(stats.time)}</p>
                        </div>
                    </div>
                )})}
            </div>
            
            <div className="mt-8 pt-8 border-t border-slate-800 flex justify-between items-center text-slate-500">
                <p className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Datos sincronizados en tiempo real
                </p>
                <p className="text-xs font-black italic tracking-tighter">ADAGAMES V4.0 - {viewCategory === 'line_follower' ? 'LINE FOLLOWER' : 'ROBOTICS QUEST'} ENGINE</p>
            </div>
        </div>
    );
}


function EvaluadorDePistas({ initialMode, tracks, updateTrackData, teams, activeTeams, addScore, currentUser, disqualifyTeam, postTeams, showToast, isRunningInMainApp, onUpdateTeamBase, onDeleteTeam }) {
  const [mode, setMode] = useState(initialMode || 'edit');
  const [penalties, setPenalties] = useState(0);
  const [attempts, setAttempts] = useState(['pending', 'pending', 'pending']);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [savedResults, setSavedResults] = useState(null);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const canvasRef = React.useRef(null);
  
  // Custom states added for multi-track real app functionality
  const [selTeam, setSelTeam] = useState('');
  const [selRonda, setSelRonda] = useState(1);
  const [selPista, setSelPista] = useState(1);
  const [showEditTeam, setShowEditTeam] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  const selectedTeamData = React.useMemo(() => teams.find(t => t.id === selTeam), [teams, selTeam]);

  const [bgImage, setBgImage] = useState(null);
  const [points, setPoints] = useState([]);
  const [guideX, setGuideX] = useState(50);
  const [guideY, setGuideY] = useState(50);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  // Usar JSON stringify para que solo cambie si el valor interno guardado realmente cambia,
  // ignorando los clones de objetos creados por el polling de 5 segundos.
  const trackDataStr = React.useMemo(() => JSON.stringify(tracks?.[selRonda]?.[selPista] || {}), [tracks, selRonda, selPista]);

  // Sincronizar el mapa al elegir otra ronda o pista, o cuando la base de datos realmente tenga un nuevo archivo
  useEffect(() => {
    let newPoints = [];
    if (tracks && tracks[selRonda] && tracks[selRonda][selPista]) {
      const data = tracks[selRonda][selPista];
      setBgImage(data.bgImage || null);
      newPoints = data.points || [];
      setGuideX(data.guideX || 50);
      setGuideY(data.guideY || 50);
    } else {
      setBgImage(null);
      setGuideX(50);
      setGuideY(50);
    }
    
    // Si estamos en modo evaluación, limpiamos el encuentro y cargamos los puntos limpios.
    if (mode === 'evaluate') {
        const cleanedPoints = newPoints.map(p => ({ ...p, isCompleted: false }));
        setPoints(cleanedPoints);
        
        setAttempts(['pending', 'pending', 'pending']);
        setCurrentAttempt(0);
        setSavedResults(null);
        setPenalties(0);
        setIsTimerRunning(false);
        setTimeLeft(120);
        setSelTeam('');
    } else {
        setPoints(newPoints);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRonda, selPista, trackDataStr]);

  const saveCurrentTrack = () => {
    if (updateTrackData) {
        updateTrackData(selRonda, selPista, { bgImage, points, guideX, guideY });
        alert(`¡Pista ${selPista} de Ronda ${selRonda} guardada centralizadamente!`);
    }
  };

  const clearCurrentTrack = () => {
      setBgImage(null);
      setPoints([]);
      setGuideX(50);
      setGuideY(50);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName.toLowerCase() === 'input') return;
      if (mode === 'edit' && selectedPointId && (e.key === 'Delete' || e.key === 'Backspace')) {
        setPoints(prevPoints => prevPoints.filter(p => p.id !== selectedPointId));
        setSelectedPointId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedPointId]);

  useEffect(() => {
    let interval;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => { setTimeLeft(prev => prev - 1); }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append("ronda", selRonda);
      formData.append("pista", selPista);
      formData.append("file", file);

      try {
        const response = await fetch(`${API_BASE}/upload_map`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.url) {
            setBgImage(data.url);
        }
      } catch (err) {
        console.error("Error subiendo mapa:", err);
        // Fallback local en caso de error
        const reader = new FileReader();
        reader.onload = (event) => setBgImage(event.target.result);
        reader.readAsDataURL(file);
      }
    }
  };

  const getQuadrant = (x, y) => {
    if (x <= guideX && y <= guideY) return 'Q1';
    if (x > guideX && y <= guideY) return 'Q2';
    if (x <= guideX && y > guideY) return 'Q3';
    return 'Q4';
  };

  const stats = React.useMemo(() => {
    let totalScore = 0;
    let maxTotal = 0;
    const quadrants = {
      Q1: { score: 0, max: 0 }, Q2: { score: 0, max: 0 },
      Q3: { score: 0, max: 0 }, Q4: { score: 0, max: 0 }
    };
    points.forEach(p => {
      const q = getQuadrant(p.x, p.y);
      quadrants[q].max += p.value;
      maxTotal += p.value;
      if (p.isCompleted) {
        quadrants[q].score += p.value;
        totalScore += p.value;
      }
    });
    const percentage = maxTotal > 0 ? ((totalScore / maxTotal) * 100).toFixed(1) : 0;
    return { totalScore, maxTotal, quadrants, percentage };
  }, [points, guideX, guideY]);

  const existingEvaluation = React.useMemo(() => {
    if (!selTeam || !teams) return null;
    const team = teams.find(t => t.id === selTeam);
    return team?.history.find(h => h.ronda === selRonda && h.pista === selPista);
  }, [teams, selTeam, selRonda, selPista]);

  const handleCanvasClick = (e) => {
    if (mode !== 'edit') return;
    if (dragTarget || e.target.closest('.point-marker') || e.target.closest('.guide-handle')) return; 
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newPoint = { id: Date.now(), x, y, value: 10, isCompleted: false };
    setPoints([...points, newPoint]);
    setSelectedPointId(newPoint.id);
  };

  const handleMouseMove = (e) => {
    if (mode !== 'edit' || !dragTarget) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));
    if (dragTarget.type === 'point') {
      setPoints(points.map(p => p.id === dragTarget.id ? { ...p, x, y } : p));
    } else if (dragTarget.type === 'guideX') {
      setGuideX(x);
    } else if (dragTarget.type === 'guideY') {
      setGuideY(y);
    }
  };

  const handleMouseUp = () => setDragTarget(null);

  const handlePointInteraction = (e, id) => {
    e.stopPropagation();
    if (mode === 'edit') {
      setSelectedPointId(id);
    } else {
      if (attempts[currentAttempt] === 'valid' || existingEvaluation) return;
      setPoints(points.map(p => p.id === id ? { ...p, isCompleted: !p.isCompleted } : p));
    }
  };

  const handlePointMouseDown = (e, id) => {
    if (mode === 'edit') {
      e.stopPropagation();
      setDragTarget({ type: 'point', id });
      setSelectedPointId(id);
    }
  };

  const updatePointValue = (id, newValue) => {
    setPoints(points.map(p => p.id === id ? { ...p, value: Number(newValue) } : p));
  };

  const deletePoint = (id) => {
    setPoints(points.filter(p => p.id !== id));
    if (selectedPointId === id) setSelectedPointId(null);
  };

  const resetEvaluation = () => {
    setPoints(points.map(p => ({ ...p, isCompleted: false })));
    setPenalties(0);
    setIsTimerRunning(false);
    setTimeLeft(120);
  };

  const handleNulledAttempt = () => {
    if (currentAttempt > 2 || attempts[currentAttempt] === 'valid') return;
    const newAttempts = [...attempts];
    newAttempts[currentAttempt] = 'nulled';
    setAttempts(newAttempts);
    resetEvaluation();
    if (currentAttempt < 2) setCurrentAttempt(currentAttempt + 1);
  };

  const handleValidAttempt = () => {
    if (currentAttempt > 2 || attempts[currentAttempt] === 'valid') return;
    const newAttempts = [...attempts];
    newAttempts[currentAttempt] = 'valid';
    setAttempts(newAttempts);
    setIsTimerRunning(false);
    const timeElapsed = 120 - timeLeft;
    const finalTime = timeElapsed + (penalties * 5);
    setSavedResults({ score: stats.totalScore, percentage: stats.percentage, timeElapsed, penalties, finalTime });
  };

  const handleResetMatch = () => {
    setAttempts(['pending', 'pending', 'pending']);
    setCurrentAttempt(0);
    setSavedResults(null);
    resetEvaluation();
  };

  const toggleMode = (newMode) => {
    if (newMode === 'evaluate') {
      setSelectedPointId(null);
    } else {
      handleResetMatch();
    }
    setMode(newMode);
  };

  const handleConfirmSave = () => {
    if (!selTeam || !addScore || existingEvaluation || !savedResults) return;
    addScore(selTeam, selRonda, selPista, savedResults.score, (savedResults.finalTime * 1000));
    handleResetMatch();
    setSelTeam('');
    setShowConfirmSave(false);
  };

  const safeSaveRealApp = () => {
    if (!selTeam || !addScore || existingEvaluation || !savedResults) return;
    setShowConfirmSave(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#0f111a] text-slate-200 font-sans overflow-hidden select-none md:rounded-[2.5rem] shadow-xl">
      
      {initialMode === 'evaluate' && (
      <div className="w-full md:w-80 bg-[#161925] border-b md:border-b-0 md:border-r border-[#2a2e3f] flex flex-col z-10 shadow-2xl relative overflow-y-auto custom-scrollbar max-h-[40vh] md:max-h-full">
        <div className="p-4 md:p-6 border-b border-[#2a2e3f] shrink-0">
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2 tracking-wide mb-3 md:mb-4">
            <Icon name="play-circle" className="w-5 h-5 text-blue-500 fill-blue-500" /> MESA DEL JUEZ
          </h1>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-semibold">Equipo en Pista</p>
          <div className="flex gap-2">
            <select value={selTeam} onChange={e => setSelTeam(e.target.value)} className="mt-2 w-full bg-[#0f111a] border border-[#2a2e3f] text-xs md:text-sm rounded-lg p-2 md:p-2.5 outline-none transition-colors">
              <option value="">-- Seleccionar Equipo --</option>
              {(isRunningInMainApp ? teams.filter(t => t.status === 'inspected' && t.category === 'line_follower' && (t.qualifiedRounds || [1]).includes(selRonda)) : activeTeams).map(t => <option key={t.id} value={t.id}>{t.teamName} ({t.schoolName})</option>)}
            </select>
            {selTeam && currentUser?.role === 'admin' && (
                <button onClick={() => setShowEditTeam(true)} className="mt-2 bg-[#1a1d2d] border border-[#2a2e3f] p-2.5 rounded-lg text-blue-400 hover:bg-[#2a2e3f] transition-all flex-shrink-0">
                    <Icon name="settings" className="w-5 h-5" />
                </button>
            )}
          </div>

          <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
            <div className="flex-1">
              <p className="text-[9px] md:text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ronda</p>
              <select value={selRonda} onChange={e => setSelRonda(parseInt(e.target.value))} className="w-full bg-[#0f111a] border border-[#2a2e3f] text-[10px] md:text-sm rounded-lg p-1.5 md:p-2.5 outline-none">
                {[1,2,3,4,5].map(r => <option key={r} value={r}>Ronda {r}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <p className="text-[9px] md:text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Pista</p>
              <select value={selPista} onChange={e => setSelPista(parseInt(e.target.value))} className="w-full bg-[#0f111a] border border-[#2a2e3f] text-[10px] md:text-sm rounded-lg p-1.5 md:p-2.5 outline-none">
                {[1,2,3,4,5].map(p => <option key={p} value={p}>Pista {p}</option>)}
              </select>
            </div>
            </div>
          </div>
          

        <div className="p-4 md:p-6 flex-1 flex flex-col pt-3 md:pt-4 relative overflow-hidden">
          {existingEvaluation && <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
              <div className="bg-white/90 px-6 py-3 rounded-full shadow-2xl border border-white font-black text-blue-900 uppercase tracking-widest text-[10px] md:text-xs flex items-center gap-3">
                <Icon name="lock" className="w-4 h-4" /> Ya Evaluado
              </div>
          </div>}
          <div className="flex flex-col items-center mb-4 md:mb-6">
            <span className="text-[9px] md:text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Intentos (Máx 3)</span>
            <div className="flex gap-3 md:gap-4">
              {attempts.map((st, i) => (
                <div key={i} className={`w-4 h-4 md:w-5 md:h-5 rounded-full border-2 transition-all ${st === 'valid' ? 'bg-green-500 border-green-400 shadow-[0_0_12px_#22c55e]' : st === 'nulled' ? 'bg-red-500 border-red-400 shadow-[0_0_12px_#ef4444]' : i === currentAttempt ? 'bg-yellow-500/50 border-yellow-400 animate-pulse' : 'bg-slate-800 border-slate-600'}`}/>
              ))}
            </div>
          </div>

          <div className="bg-[#1c1f2e] border border-[#2a2e3f] rounded-2xl p-3 md:p-4 mb-4 md:mb-6 flex flex-col items-center shadow-inner shrink-0 leading-none">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="timer" className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
              <span className="text-[9px] md:text-xs text-slate-400 uppercase tracking-wider font-semibold">Tiempo Restante</span>
            </div>
            <div className={`text-3xl md:text-5xl font-mono font-bold tracking-widest mb-3 md:mb-4 ${timeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="flex gap-2 w-full">
              {!isTimerRunning ? (
                <button onClick={() => setIsTimerRunning(true)} disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2 || timeLeft === 0 || !selTeam} className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                  <Icon name="play" className="w-4 h-4" /> Iniciar
                </button>
              ) : (
                <button onClick={() => setIsTimerRunning(false)} className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors">
                  <Icon name="pause" className="w-4 h-4" /> Pausar
                </button>
              )}
            </div>
          </div>

          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 shadow-lg border mb-6 shrink-0 ${savedResults ? 'bg-green-900/40 border-green-500/50' : 'bg-blue-600 border-blue-500'}`}>
            <span className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">{savedResults ? 'Puntaje Final' : 'Puntos Actuales'}</span>
            <span className="text-6xl font-bold tracking-tighter mb-1">{savedResults ? savedResults.score : (existingEvaluation ? existingEvaluation.points : stats.totalScore)}</span>
            <span className="text-xs font-medium opacity-90 bg-black/30 px-3 py-1 rounded-full flex gap-2">
              <span>{stats.maxTotal} MAX</span>
              <span className="border-l border-white/20 pl-2">{savedResults ? savedResults.percentage : stats.percentage}%</span>
            </span>
          </div>

          <div className="flex gap-3 mb-6 shrink-0">
            <button onClick={() => setPenalties(p => p + 1)} disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2 || !selTeam} className="flex-1 bg-[#1c1f2e] border border-orange-500/30 hover:border-orange-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-3 rounded-xl flex flex-col items-center justify-center gap-1 group">
              <Icon name="alert-triangle" className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-orange-400 uppercase text-center leading-tight">Penalización<br/>(+5s)</span>
              <span className="bg-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded-full text-xs mt-1">{penalties}</span>
            </button>
            <button onClick={handleNulledAttempt} disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2 || !selTeam} className="flex-1 bg-[#1c1f2e] border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all p-3 rounded-xl flex flex-col items-center justify-center gap-1 group">
              <Icon name="ban" className="w-5 h-5 text-red-400 group-hover:text-red-500 group-hover:scale-110 transition-all" />
              <span className="text-[10px] font-bold text-red-400 uppercase text-center leading-tight">Intento<br/>Nulo</span>
            </button>
          </div>

          <div className="mt-auto flex flex-col gap-3 shrink-0">
            {savedResults && (
               <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 text-xs text-slate-300">
                  <div className="flex justify-between mb-1"><span>Tiempo Neto:</span> <span>{formatTime(savedResults.timeElapsed)}</span></div>
                  <div className="flex justify-between mb-1 text-orange-400"><span>Penalizaciones:</span> <span>+{savedResults.penalties * 5}s</span></div>
                  <div className="flex justify-between font-bold text-white border-t border-slate-600 pt-1 mt-1"><span>Tiempo Oficial:</span> <span>{formatTime(savedResults.finalTime)}</span></div>
               </div>
            )}
            {!savedResults && currentAttempt <= 2 ? (
              <button onClick={handleValidAttempt} disabled={(!isTimerRunning && timeLeft === 120) || !selTeam} className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold px-2 py-3.5 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2">
                <Icon name="check-circle" className="w-4 h-4" /> REGISTRAR INTENTO VÁLIDO
              </button>
            ) : (
               <button onClick={handleResetMatch} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
                <Icon name="rotate-ccw" className="w-4 h-4" /> Reiniciar Ronda
              </button>
            )}
            <button onClick={safeSaveRealApp} disabled={!savedResults || existingEvaluation} className="w-full bg-blue-600 hover:bg-blue-500 flex-wrap disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold px-2 py-3.5 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2">
              <Icon name="save" className="w-4 h-4" /> GUARDAR RESULTADO FINAL
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="flex-1 flex flex-col relative overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <div className="h-16 border-b border-[#2a2e3f] bg-[#161925] px-8 flex items-center justify-between z-10 shrink-0">
            <h2 className="text-xl font-bold tracking-wide flex items-center gap-2 text-white">
                <Icon name={mode === 'edit' ? 'map' : 'play-circle'} className="w-5 h-5 text-blue-500" />
                {mode === 'edit' ? 'CONFIGURAR NUEVO MAPA' : 'TABLERO DE EVALUACIÓN'}
            </h2>
            {mode === 'edit' && (
              <div className="flex gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold uppercase">Ronda</span>
                    <select value={selRonda} onChange={e => setSelRonda(parseInt(e.target.value))} className="bg-[#0a0c12] border border-[#2a2e3f] rounded-lg px-2 py-1 text-sm text-white font-bold cursor-pointer">
                        {[1,2,3,4,5].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold uppercase">Pista</span>
                    <select value={selPista} onChange={e => setSelPista(parseInt(e.target.value))} className="bg-[#0a0c12] border border-[#2a2e3f] rounded-lg px-2 py-1 text-sm text-white font-bold cursor-pointer">
                        {[1,2,3,4,5].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <button onClick={saveCurrentTrack} className="ml-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95">
                      <Icon name="save" className="w-4 h-4"/> Guardar Pista
                  </button>
                  <button 
                    onClick={async () => {
                      if (!canvasRef.current) return;
                      showToast("Generando imagen...");
                      const canvas = await html2canvas(canvasRef.current, {
                        useCORS: true,
                        scale: 2,
                        backgroundColor: '#ffffff'
                      });
                      const link = document.createElement('a');
                      link.download = `pista_${selRonda}_${selPista}.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                      showToast("Imagen descargada");
                    }} 
                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg hover:scale-105 active:scale-95"
                  >
                      <Icon name="image" className="w-4 h-4"/> Exportar PNG
                  </button>
                  <button onClick={clearCurrentTrack} title="Limpiar Pista" className="bg-red-500/20 hover:bg-red-500 hover:text-white text-red-400 border border-red-500/30 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                      <Icon name="trash-2" className="w-4 h-4"/>
                  </button>
              </div>
            )}
          <div className="flex gap-6 text-sm font-medium bg-[#0f111a] py-2 px-4 rounded-xl border border-[#2a2e3f]">
            {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
              <div key={q} className="flex flex-col items-center">
                <span className="text-[10px] text-slate-500 mb-0.5">{q}</span>
                <span className={stats.quadrants[q].score === stats.quadrants[q].max && stats.quadrants[q].max > 0 ? 'text-green-400' : 'text-slate-300'}>
                  {stats.quadrants[q].score}/{stats.quadrants[q].max || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-8 relative overflow-hidden flex items-center justify-center bg-[#0a0c12]">
          <div className="relative w-full max-w-5xl aspect-[16/10]">
            <div className="absolute -top-6 left-0 text-xs font-bold text-slate-400 pointer-events-none">Q1 Sup Izq</div>
            <div className="absolute -top-6 right-0 text-xs font-bold text-slate-400 pointer-events-none">Q2 Sup Der</div>
            <div className="absolute -bottom-6 left-0 text-xs font-bold text-slate-400 pointer-events-none">Q3 Inf Izq</div>
            <div className="absolute -bottom-6 right-0 text-xs font-bold text-slate-400 pointer-events-none">Q4 Inf Der</div>

            <div ref={canvasRef} onClick={handleCanvasClick} className={`relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-2xl border-2 ${mode === 'edit' ? 'border-dashed border-blue-500/50 cursor-crosshair' : 'border-solid border-[#2a2e3f]'}`}>
              {bgImage ? (
                <img src={bgImage} alt="Pista" className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-slate-500 pointer-events-none">
                  <Icon name="image" className="w-16 h-16 mb-4 opacity-30 text-slate-800" />
                  <p className="font-semibold text-lg text-slate-600">Sube una imagen para la pista</p>
                  {mode === 'edit' && <p className="text-sm mt-2 text-slate-500">Haz clic en el panel inferior para cargar</p>}
                </div>
              )}
              <div className={`guide-handle absolute top-0 bottom-0 w-6 -ml-3 flex justify-center z-10 ${mode === 'edit' ? 'cursor-col-resize hover:bg-black/5' : 'pointer-events-none'}`} style={{ left: `${guideX}%` }} onMouseDown={(e) => { if (mode === 'edit') { e.stopPropagation(); setDragTarget({type: 'guideX'}); } }}>
                <div className="w-0 h-full border-l-4 border-dashed border-red-500/80" />
              </div>
              <div className={`guide-handle absolute left-0 right-0 h-6 -mt-3 flex items-center z-10 ${mode === 'edit' ? 'cursor-row-resize hover:bg-black/5' : 'pointer-events-none'}`} style={{ top: `${guideY}%` }} onMouseDown={(e) => { if (mode === 'edit') { e.stopPropagation(); setDragTarget({type: 'guideY'}); } }}>
                <div className="h-0 w-full border-t-4 border-dashed border-red-500/80" />
              </div>
              {points.map(point => (
                <div key={point.id} className={`point-marker absolute -translate-x-1/2 -translate-y-1/2 rounded shadow-lg flex items-center justify-center font-bold text-xs transition-all ${mode === 'evaluate' ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-grab active:cursor-grabbing'} ${mode === 'edit' && selectedPointId === point.id ? 'ring-2 ring-yellow-400 z-20' : 'z-10'} ${point.isCompleted && mode === 'evaluate' ? 'bg-blue-600 text-white border border-blue-400' : 'bg-[#2a2e3f] text-slate-300 border border-slate-600'}`} style={{ left: `${point.x}%`, top: `${point.y}%`, width: '42px', height: '24px' }} onClick={(e) => handlePointInteraction(e, point.id)} onMouseDown={(e) => handlePointMouseDown(e, point.id)}>
                  {point.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-24 bg-[#161925] border-t border-[#2a2e3f] px-6 py-4 flex items-center shrink-0 z-10">
          {mode === 'edit' ? (
            <div className="flex w-full items-center justify-between gap-6">
              <div className="flex items-center gap-4 bg-[#0f111a] px-4 py-2 rounded-xl border border-[#2a2e3f]">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold hover:text-blue-400 transition-colors">
                  <Icon name="upload" className="w-5 h-5" /> <span>Cargar Mapa</span>
                  <input type="file" accept="image/*,.svg,image/svg+xml" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              <div className="flex items-center gap-6 bg-[#0f111a] px-6 py-2 rounded-xl border border-[#2a2e3f] flex-1 max-w-xl">
                <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">Guías Cuadrantes:</span>
                <div className="flex items-center gap-2 flex-1"><span className="text-xs font-bold text-red-400">X</span><input type="range" min="0" max="100" value={guideX} onChange={(e) => setGuideX(e.target.value)} className="w-full accent-red-500 h-1" /></div>
                <div className="flex items-center gap-2 flex-1"><span className="text-xs font-bold text-red-400">Y</span><input type="range" min="0" max="100" value={guideY} onChange={(e) => setGuideY(e.target.value)} className="w-full accent-red-500 h-1" /></div>
              </div>
              <div className={`flex items-center gap-3 px-6 py-2 rounded-xl border transition-all ${selectedPointId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-[#0f111a] border-[#2a2e3f] opacity-50'}`}>
                <span className="text-sm font-semibold text-slate-300">Valor Pieza:</span>
                <input type="number" value={selectedPointId ? points.find(p => p.id === selectedPointId)?.value || 0 : ''} onChange={(e) => selectedPointId && updatePointValue(selectedPointId, e.target.value)} disabled={!selectedPointId} className="w-20 bg-[#1a1d2d] border border-[#2a2e3f] rounded px-2 py-1 text-center font-bold focus:outline-none focus:border-blue-500 text-slate-200" />
                <button onClick={() => selectedPointId && deletePoint(selectedPointId)} disabled={!selectedPointId} className="p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded transition-colors disabled:opacity-50"><Icon name="trash-2" className="w-5 h-5" /></button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center gap-3 bg-blue-900/20 border border-blue-500/30 text-blue-200 py-3 px-6 rounded-xl">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center shrink-0"><span className="font-bold text-sm text-white">i</span></div>
              <p className="text-sm font-medium">Instrucciones: Pulsa sobre cada pieza del mapa para marcarla como completada en la rutina del robot.</p>
            </div>
          )}
        </div>
      </div>
      
      {showEditTeam && selTeam && teams && (
          <EditTeamModal 
              team={teams.find(t => t.id === selTeam)} 
              onClose={() => setShowEditTeam(false)} 
              onSave={(name, school) => {
                  if (onUpdateTeamBase) onUpdateTeamBase(selTeam, name, school);
                  setShowEditTeam(false);
              }} 
              onDelete={() => {
                  setShowEditTeam(false);
                  if (onDeleteTeam) onDeleteTeam(selTeam);
                  setSelTeam('');
              }}
          />
      )}

      {showConfirmSave && savedResults && selTeam && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#161925] rounded-[2rem] shadow-2xl w-full max-w-lg border border-[#2a2e3f] overflow-hidden animate-fadeIn">
                  <div className="bg-blue-600 p-6 flex justify-between items-center">
                      <div>
                          <p className="text-blue-200 text-[10px] font-black uppercase tracking-widest mb-1">Confirmación de Juez</p>
                          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                              <Icon name="check-square" className="w-6 h-6" /> VERIFICAR DATOS
                          </h3>
                      </div>
                      <button onClick={() => setShowConfirmSave(false)} className="text-white/50 hover:text-white transition-colors bg-black/20 p-2 rounded-full">
                          <Icon name="x" className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      <div className="bg-[#0f111a] p-4 rounded-xl border border-[#2a2e3f]">
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Equipo Evaluado</p>
                          <p className="text-lg font-black text-white">{selectedTeamData?.teamName}</p>
                          <p className="text-sm text-slate-400 font-medium">{selectedTeamData?.schoolName}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#0f111a] p-4 rounded-xl border border-[#2a2e3f] text-center">
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Puntuación Final</p>
                              <p className="text-4xl font-black text-blue-400">{savedResults.score}</p>
                              <p className="text-xs text-slate-500 mt-1">Puntos</p>
                          </div>
                          <div className="bg-[#0f111a] p-4 rounded-xl border border-[#2a2e3f] text-center">
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Tiempo Registrado</p>
                              <p className="text-3xl font-black text-orange-400 mt-1">{savedResults.finalTime.toFixed(2)}s</p>
                              <p className="text-xs text-slate-500 mt-1">Segundos</p>
                          </div>
                      </div>

                      <div className="bg-[#0f111a] p-4 rounded-xl border border-[#2a2e3f] grid grid-cols-2 gap-4">
                          <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ronda</p>
                              <p className="text-sm font-bold text-slate-200">Ronda {selRonda}</p>
                          </div>
                          <div>
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Pista</p>
                              <p className="text-sm font-bold text-slate-200">Pista {selPista}</p>
                          </div>
                      </div>



                      <div className="pt-2 flex gap-3">
                          <button onClick={() => setShowConfirmSave(false)} className="flex-1 py-4 bg-[#1a1d2d] hover:bg-[#2a2e3f] text-slate-300 font-bold rounded-xl transition-all">
                              Cancelar
                          </button>
                          <button onClick={handleConfirmSave} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                              <Icon name="save" className="w-5 h-5" /> CONFIRMAR
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}


function UsuariosTab({ users, fetchUsers, showToast, setConfirmDialog }) {
  const [newUserId, setNewUserId] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleAddUser = async () => {
    if (!newUserId || !newName || !newPassword) return;
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newUserId, name: newName, password: newPassword, role: 'judge' })
      });
      if (res.ok) {
        showToast('Usuario guardado');
        setNewUserId(''); setNewName(''); setNewPassword('');
        fetchUsers();
      }
    } catch (err) {
      showToast('Error al guardar usuario');
    }
  };

  const handleDeleteUser = (userId) => {
    if (userId === 'admin') return;
    setConfirmDialog({
      message: `¿Estás seguro de eliminar al usuario ${userId}?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
          if (res.ok) {
            showToast('Usuario eliminado');
            fetchUsers();
          }
        } catch (err) {
          showToast('Error al eliminar usuario');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-blue-900 mb-6 uppercase italic flex items-center gap-3">
          <Icon name="user-plus" className="text-blue-600" /> Añadir Nuevo Juez
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="ID de Usuario (ej: juez2)" className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500" />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre Completo" className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500" />
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Contraseña" className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-100 font-bold outline-none focus:border-blue-500" />
        </div>
        <button onClick={handleAddUser} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all uppercase tracking-widest">
          Registrar Juez
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-100 text-slate-500">
            <tr>
              <th className="p-6 text-[10px] uppercase font-black">Usuario</th>
              <th className="p-6 text-[10px] uppercase font-black">Nombre</th>
              <th className="p-6 text-[10px] uppercase font-black">Rol</th>
              <th className="p-6 text-[10px] uppercase font-black text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 font-bold text-blue-900">{u.id}</td>
                <td className="p-6 font-medium text-slate-600">{u.name}</td>
                <td className="p-6">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {u.role.toUpperCase()}
                  </span>
                </td>
                <td className="p-6 text-right">
                  {u.id !== 'admin' && (
                    <button onClick={() => handleDeleteUser(u.id)} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                      <Icon name="trash-2" className="w-5 h-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// Renderizado final
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

function FasesTab({ teams, onUpdateQualified, onUpdateManyQualified, showToast, currentUser }) {
  const [selRonda, setSelRonda] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const RONDAS = [1, 2, 3, 4, 5];

  // Solo mostrar equipos aprobados en inspección
  const inspectedTeams = useMemo(() => teams.filter(t => t.status === 'inspected'), [teams]);

  // Helper para obtener estadísticas de una ronda específica (Solo Evaluaciones Oficiales)
  const getStats = (team, ronda) => {
    const rh = team.history.filter(h => h.ronda === Number(ronda) && h.practice !== true);
    if (rh.length === 0) return { score: 0, time: 999999, played: false };
    const score = rh.reduce((sum, h) => sum + (h.points || h.percentage || 0), 0);
    const time = rh.reduce((sum, h) => sum + (h.finalTimeMs || h.finalTime || 0), 0);
    return { score, time, played: true };
  };

  const currentQualified = inspectedTeams.filter(t => (t.qualifiedRounds || [1]).includes(selRonda));
  
  // Ordenar equipos de la ronda actual por desempeño
  const rankedTeams = useMemo(() => {
    return [...inspectedTeams].sort((a, b) => {
      const isQualA = (a.qualifiedRounds || [1]).includes(selRonda);
      const isQualB = (b.qualifiedRounds || [1]).includes(selRonda);
      if (isQualA !== isQualB) return isQualB ? 1 : -1;

      const sA = getStats(a, selRonda);
      const sB = getStats(b, selRonda);
      if (sB.score !== sA.score) return sB.score - sA.score;
      return sA.time - sB.time;
    });
  }, [inspectedTeams, selRonda]);

  const toggleRound = (team, r) => {
    let rounds = [...(team.qualifiedRounds || [1])];
    if (rounds.includes(r)) {
      if (r === 1 && rounds.length === 1) return;
      rounds = rounds.filter(x => x !== r);
    } else {
      rounds.push(r);
    }
    onUpdateQualified(team.id, rounds);
  };

  const promoteSelected = (toRonda) => {
    if (selectedIds.length === 0) {
        showToast("Selecciona equipos primero");
        return;
    }
    const updates = {};
    selectedIds.forEach(id => {
        const team = teams.find(t => t.id === id);
        if (team && !(team.qualifiedRounds || [1]).includes(toRonda)) {
            updates[id] = [...(team.qualifiedRounds || [1]), toRonda];
        }
    });

    if (Object.keys(updates).length > 0) {
        onUpdateManyQualified(updates);
        showToast(`✅ ${Object.keys(updates).length} equipos calificados para Ronda ${toRonda}`);
    } else {
        showToast("Los equipos seleccionados ya estaban calificados");
    }
    setSelectedIds([]);
  };

  const selectTop50 = () => {
    const played = rankedTeams.filter(t => getStats(t, selRonda).played && (t.qualifiedRounds || [1]).includes(selRonda));
    if (played.length === 0) {
      showToast("No hay equipos con puntaje en esta ronda para sugerir");
      return;
    }
    const countToPromote = Math.ceil(played.length / 2);
    const winners = played.slice(0, countToPromote);
    
    setSelectedIds(winners.map(t => t.id));
    showToast(`✨ Seleccionados los ${winners.length} mejores equipos de la Ronda ${selRonda}`);
  };

  const selectLosersR3 = () => {
    const played = rankedTeams.filter(t => getStats(t, selRonda).played && (t.qualifiedRounds || [1]).includes(selRonda));
    if (played.length === 0) {
      showToast("No hay equipos con puntaje para evaluar");
      return;
    }
    const countToPromote = Math.ceil(played.length / 2);
    const losers = played.slice(countToPromote);
    
    setSelectedIds(losers.map(t => t.id));
    showToast(`✨ Seleccionados los ${losers.length} equipos para Repechaje (R3)`);
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn max-w-6xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-blue-900 uppercase italic">Gestión de Fases</h2>
            <p className="text-[10px] md:text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Control de acceso y promoción masiva</p>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
            {RONDAS.map(r => (
              <button key={r} onClick={() => {setSelRonda(r); setSelectedIds([]);}} className={`flex-1 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all ${selRonda === r ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-200'}`}>
                R{r}{r === 3 ? ' (Rep)' : r === 5 ? ' (Fin)' : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* ASISTENTES DE PROMOCIÓN */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
              <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Icon name="check-square" className="w-4 h-4"/> Acciones Masivas
              </h3>
              <div className="space-y-3">
                {selectedIds.length > 0 && (
                    <div className="p-3 bg-white rounded-xl border border-blue-200 mb-2 animate-bounce">
                        <p className="text-[9px] font-black text-blue-600 uppercase text-center">{selectedIds.length} seleccionados</p>
                    </div>
                )}
                
                <div className="grid grid-cols-1 gap-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Calificar seleccionados para:</p>
                    <div className="flex flex-wrap gap-1">
                        {RONDAS.map(r => (
                            <button 
                                key={r}
                                onClick={() => promoteSelected(r)}
                                disabled={selectedIds.length === 0}
                                className="flex-1 min-w-[40px] bg-white border border-blue-200 text-blue-600 py-2 rounded-lg font-black text-[10px] hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 disabled:grayscale"
                            >
                                R{r}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-4 border-t border-blue-100">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase mb-2">Asistentes Sugeridos</h4>
                    <button onClick={() => selectTop50()} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-500/30 transition-all mb-2">Marcar Ganadores (Top 50%)</button>
                    {(selRonda === 1 || selRonda === 2) && (
                        <button onClick={() => selectLosersR3()} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-orange-500/30 transition-all">Marcar Perdedores para R3</button>
                    )}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
               <p className="text-[9px] font-bold text-slate-400 uppercase leading-tight">En esta ronda participan:</p>
               <p className="text-3xl font-black text-slate-800 leading-none mt-1">{currentQualified.length} <span className="text-xs text-slate-400 uppercase">Equipos</span></p>
            </div>
          </div>

          {/* MATRIZ DE CALIFICACIÓN */}
          <div className="lg:col-span-3">
             <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="p-4 w-12">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                            onChange={(e) => setSelectedIds(e.target.checked ? inspectedTeams.map(t => t.id) : [])}
                            checked={selectedIds.length === inspectedTeams.length && inspectedTeams.length > 0}
                          />
                      </th>
                      <th className="p-4 text-[9px] font-black uppercase">Equipo / Escuela</th>
                      <th className="p-4 text-[9px] font-black uppercase text-center">Score R{selRonda}</th>
                      <th className="p-4 text-[9px] font-black uppercase text-center">Calificación Manual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rankedTeams.map(t => {
                      const stats = getStats(t, selRonda);
                      const isQualCurrent = (t.qualifiedRounds || [1]).includes(selRonda);
                      const isSelected = selectedIds.includes(t.id);
                      
                      return (
                        <tr key={t.id} className={`${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                          <td className="p-4">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                checked={isSelected}
                                onChange={() => toggleSelection(t.id)}
                            />
                          </td>
                          <td className="p-4">
                            <p className={`text-sm font-black leading-tight ${isQualCurrent ? 'text-slate-800' : 'text-slate-400 grayscale'}`}>{getTeamDisplayNames(t).team}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{getTeamDisplayNames(t).school}</p>
                            {!isQualCurrent && <span className="text-[7px] font-black text-slate-300 uppercase tracking-tighter">No calificado para esta ronda</span>}
                          </td>
                          <td className="p-4 text-center">
                            <div className={`inline-block px-3 py-1 rounded-lg font-black text-xs ${stats.score > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-300'}`}>
                              {stats.score}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1">
                              {RONDAS.map(r => {
                                const q = (t.qualifiedRounds || [1]).includes(r);
                                return (
                                  <button 
                                    key={r} 
                                    onClick={() => toggleRound(t, r)}
                                    className={`w-7 h-7 rounded-lg text-[9px] font-black transition-all border-2 ${q ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-100 text-slate-300 hover:border-blue-300 hover:text-blue-300'}`}
                                  >
                                    {r}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}
