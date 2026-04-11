import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, 
  Settings, 
  Play, 
  Trash2, 
  AlertTriangle, 
  Ban, 
  Image as ImageIcon,
  Save,
  Timer,
  CheckCircle,
  Pause,
  RotateCcw
} from 'lucide-react';

export default function App() {
  // Estados principales
  const [mode, setMode] = useState('edit'); // 'edit' o 'evaluate'
  const [bgImage, setBgImage] = useState(null);
  const [points, setPoints] = useState([]); // { id, x, y, value, isCompleted }
  
  // Guías de cuadrantes (porcentajes 0-100)
  const [guideX, setGuideX] = useState(50);
  const [guideY, setGuideY] = useState(50);
  
  // Estado del intento y temporizador
  const [penalties, setPenalties] = useState(0);
  const [attempts, setAttempts] = useState(['pending', 'pending', 'pending']); // 'pending', 'valid', 'nulled'
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 120 segundos = 2 min
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [savedResults, setSavedResults] = useState(null); // Resultados finales del intento válido
  
  // Estado de edición (Arrastrar y soltar)
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [dragTarget, setDragTarget] = useState(null); // Puede ser null, {type: 'point', id}, {type: 'guideX'} o {type: 'guideY'}
  const canvasRef = useRef(null);

  // Escuchar la tecla "Suprimir" o "Retroceso" para borrar puntos rápidamente
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo dentro de un input (ej. cambiando el valor numérico)
      if (e.target.tagName.toLowerCase() === 'input') return;
      
      if (mode === 'edit' && selectedPointId && (e.key === 'Delete' || e.key === 'Backspace')) {
        setPoints(prevPoints => prevPoints.filter(p => p.id !== selectedPointId));
        setSelectedPointId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedPointId]);

  // Lógica del Temporizador
  useEffect(() => {
    let interval;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
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

  // Cargar imagen de fondo
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setBgImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  // Determinar a qué cuadrante pertenece un punto
  const getQuadrant = (x, y) => {
    if (x <= guideX && y <= guideY) return 'Q1'; // Sup Izq
    if (x > guideX && y <= guideY) return 'Q2';  // Sup Der
    if (x <= guideX && y > guideY) return 'Q3';  // Inf Izq
    return 'Q4';                                 // Inf Der
  };

  // Cálculos de puntuación
  const stats = useMemo(() => {
    let totalScore = 0;
    let maxTotal = 0;
    const quadrants = {
      Q1: { score: 0, max: 0 },
      Q2: { score: 0, max: 0 },
      Q3: { score: 0, max: 0 },
      Q4: { score: 0, max: 0 },
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

  // Manejo de clics en el lienzo (Canvas)
  const handleCanvasClick = (e) => {
    if (mode !== 'edit') return;
    // Evitar crear punto si arrastramos algo o tocamos elementos interactivos
    if (dragTarget || e.target.closest('.point-marker') || e.target.closest('.guide-handle')) return; 

    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newPoint = {
      id: Date.now(),
      x,
      y,
      value: 10, // Valor por defecto
      isCompleted: false
    };
    setPoints([...points, newPoint]);
    setSelectedPointId(newPoint.id);
  };

  // Arrastrar elementos (puntos o guías)
  const handleMouseMove = (e) => {
    if (mode !== 'edit' || !dragTarget) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Limitar a los bordes
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

  const handleMouseUp = () => {
    setDragTarget(null);
  };

  // Interacción con los puntos
  const handlePointInteraction = (e, id) => {
    e.stopPropagation(); // Evitar que el click llegue al canvas
    
    if (mode === 'edit') {
      setSelectedPointId(id);
    } else {
      // Modo evaluar: Solo permitir si no se ha validado de forma definitiva
      if (attempts[currentAttempt] === 'valid') return;
      setPoints(points.map(p => p.id === id ? { ...p, isCompleted: !p.isCompleted } : p));
    }
  };

  // Iniciar arrastre de puntos
  const handlePointMouseDown = (e, id) => {
    if (mode === 'edit') {
      e.stopPropagation();
      setDragTarget({ type: 'point', id });
      setSelectedPointId(id);
    }
  };

  // Cambiar valor de un punto
  const updatePointValue = (id, newValue) => {
    setPoints(points.map(p => p.id === id ? { ...p, value: Number(newValue) } : p));
  };

  // Eliminar punto
  const deletePoint = (id) => {
    setPoints(points.filter(p => p.id !== id));
    if (selectedPointId === id) setSelectedPointId(null);
  };

  // Limpiar evaluación y resetear para nuevo intento
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

    resetEvaluation(); // Limpia los puntos del mapa

    if (currentAttempt < 2) {
      setCurrentAttempt(currentAttempt + 1);
    }
  };

  const handleValidAttempt = () => {
    if (currentAttempt > 2 || attempts[currentAttempt] === 'valid') return;
    
    const newAttempts = [...attempts];
    newAttempts[currentAttempt] = 'valid';
    setAttempts(newAttempts);
    
    setIsTimerRunning(false);

    const timeElapsed = 120 - timeLeft;
    const finalTime = timeElapsed + (penalties * 5); // +5s por penalidad

    setSavedResults({
      score: stats.totalScore,
      percentage: stats.percentage,
      timeElapsed,
      penalties,
      finalTime
    });
  };

  const handleResetMatch = () => {
    setAttempts(['pending', 'pending', 'pending']);
    setCurrentAttempt(0);
    setSavedResults(null);
    resetEvaluation();
  };

  // Cambiar de modo
  const toggleMode = (newMode) => {
    if (newMode === 'evaluate') {
      setSelectedPointId(null);
    } else {
      handleResetMatch();
    }
    setMode(newMode);
  };

  return (
    <div className="flex h-screen bg-[#0f111a] text-slate-200 font-sans overflow-hidden select-none">
      
      {/* SIDEBAR IZQUIERDO - MESA DEL JUEZ */}
      <div className="w-80 bg-[#161925] border-r border-[#2a2e3f] flex flex-col z-10 shadow-2xl">
        <div className="p-6 border-b border-[#2a2e3f]">
          <h1 className="text-xl font-bold text-white flex items-center gap-2 tracking-wide">
            <Play className="w-5 h-5 text-blue-500 fill-blue-500" />
            MESA DEL JUEZ
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">Robot en Pista</p>
          
          <select className="mt-2 w-full bg-[#0f111a] border border-[#2a2e3f] text-sm rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors">
            <option>-- Seleccionar Equipo --</option>
            <option>Equipo Alpha</option>
            <option>Equipo Omega</option>
          </select>

          <div className="flex gap-3 mt-4">
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ronda</p>
              <select className="w-full bg-[#0f111a] border border-[#2a2e3f] text-sm rounded-lg p-2.5 outline-none">
                <option>Ronda 1</option>
                <option>Ronda 2</option>
              </select>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Pista</p>
              <select className="w-full bg-[#0f111a] border border-[#2a2e3f] text-sm rounded-lg p-2.5 outline-none">
                <option>Pista 1</option>
                <option>Pista 2</option>
              </select>
            </div>
          </div>
        </div>

        {/* MARCADOR Y CONTROLES */}
        <div className="p-6 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
          
          {/* INDICADORES DE INTENTOS */}
          <div className="flex flex-col items-center mb-6">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Intentos (Máx 3)</span>
            <div className="flex gap-4">
              {attempts.map((status, i) => (
                <div 
                  key={i} 
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-300 ${
                    status === 'valid' ? 'bg-green-500 border-green-400 shadow-[0_0_12px_#22c55e]' :
                    status === 'nulled' ? 'bg-red-500 border-red-400 shadow-[0_0_12px_#ef4444]' :
                    i === currentAttempt ? 'bg-yellow-500/50 border-yellow-400 animate-pulse' :
                    'bg-slate-800 border-slate-600'
                  }`} 
                  title={`Intento ${i + 1}: ${status}`}
                />
              ))}
            </div>
          </div>

          {/* TEMPORIZADOR */}
          <div className="bg-[#1c1f2e] border border-[#2a2e3f] rounded-2xl p-4 mb-6 flex flex-col items-center shadow-inner">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Tiempo Restante</span>
            </div>
            <div className={`text-5xl font-mono font-bold tracking-widest mb-4 ${timeLeft <= 30 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="flex gap-2 w-full">
              {!isTimerRunning ? (
                <button 
                  onClick={() => setIsTimerRunning(true)} 
                  disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2 || timeLeft === 0}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" /> Iniciar
                </button>
              ) : (
                <button 
                  onClick={() => setIsTimerRunning(false)} 
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Pause className="w-4 h-4 fill-current" /> Pausar
                </button>
              )}
            </div>
          </div>

          {/* PUNTAJE */}
          <div className={`p-4 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 shadow-lg border mb-6 ${savedResults ? 'bg-green-900/40 border-green-500/50' : 'bg-blue-600 border-blue-500'}`}>
            <span className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-1">
              {savedResults ? 'Puntaje Final' : 'Puntos Actuales'}
            </span>
            <span className="text-6xl font-bold tracking-tighter mb-1">
              {savedResults ? savedResults.score : stats.totalScore}
            </span>
            <span className="text-xs font-medium opacity-90 bg-black/30 px-3 py-1 rounded-full flex gap-2">
              <span>{stats.maxTotal} MAX</span>
              <span className="border-l border-white/20 pl-2">{savedResults ? savedResults.percentage : stats.percentage}%</span>
            </span>
          </div>

          {/* ACCIONES DEL INTENTO */}
          <div className="flex gap-3 mb-6">
            <button 
              onClick={() => setPenalties(p => p + 1)}
              disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2}
              className="flex-1 bg-[#1c1f2e] border border-orange-500/30 hover:border-orange-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-3 rounded-xl flex flex-col items-center justify-center gap-1 group"
            >
              <AlertTriangle className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold text-orange-400 uppercase text-center leading-tight">Penalización<br/>(+5s)</span>
              <span className="bg-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded-full text-xs mt-1">{penalties}</span>
            </button>
            
            <button 
              onClick={handleNulledAttempt}
              disabled={attempts[currentAttempt] === 'valid' || currentAttempt > 2}
              className="flex-1 bg-[#1c1f2e] border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all p-3 rounded-xl flex flex-col items-center justify-center gap-1 group"
            >
              <Ban className="w-5 h-5 text-red-400 group-hover:text-red-500 group-hover:scale-110 transition-all" />
              <span className="text-[10px] font-bold text-red-400 uppercase text-center leading-tight">Intento<br/>Nulo</span>
            </button>
          </div>

          {/* FINALIZAR INTENTO */}
          <div className="mt-auto flex flex-col gap-3">
            {savedResults && (
               <div className="bg-slate-800 border border-slate-600 rounded-xl p-3 text-xs text-slate-300">
                  <div className="flex justify-between mb-1"><span>Tiempo Neto:</span> <span>{formatTime(savedResults.timeElapsed)}</span></div>
                  <div className="flex justify-between mb-1 text-orange-400"><span>Penalizaciones:</span> <span>+{savedResults.penalties * 5}s</span></div>
                  <div className="flex justify-between font-bold text-white border-t border-slate-600 pt-1 mt-1"><span>Tiempo Oficial:</span> <span>{formatTime(savedResults.finalTime)}</span></div>
               </div>
            )}

            {!savedResults && currentAttempt <= 2 ? (
              <button 
                onClick={handleValidAttempt}
                disabled={!isTimerRunning && timeLeft === 120}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-400 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                REGISTRAR INTENTO VÁLIDO
              </button>
            ) : (
               <button 
                onClick={handleResetMatch}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <RotateCcw className="w-4 h-4" /> Reiniciar Ronda
              </button>
            )}
            
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              GUARDAR RESULTADO FINAL
            </button>
          </div>
        </div>
      </div>

      {/* ÁREA PRINCIPAL - MAPA DE EVALUACIÓN */}
      <div className="flex-1 flex flex-col relative overflow-hidden" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        
        {/* HEADER SUPERIOR */}
        <div className="h-20 border-b border-[#2a2e3f] bg-[#161925] px-8 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-xl font-bold tracking-wide">MAPA DE EVALUACIÓN</h2>
            
            {/* TABS DE MODO */}
            <div className="flex bg-[#0f111a] p-1 rounded-lg border border-[#2a2e3f]">
              <button 
                onClick={() => toggleMode('edit')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'edit' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Settings className="w-4 h-4" /> Configurar Pista
              </button>
              <button 
                onClick={() => toggleMode('evaluate')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${mode === 'evaluate' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Play className="w-4 h-4" /> Evaluar
              </button>
            </div>
          </div>

          {/* ESTADÍSTICAS POR CUADRANTE (Solo visibles/relevantes en header) */}
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

        {/* CONTENEDOR DEL LIENZO */}
        <div className="flex-1 p-8 relative overflow-hidden flex items-center justify-center bg-[#0a0c12]">
          
          <div className="relative w-full max-w-5xl aspect-[16/10]">
            {/* Etiquetas de Cuadrantes (Fuera del lienzo visual) */}
            <div className="absolute -top-6 left-0 text-xs font-bold text-slate-400 pointer-events-none">Q1 Superior Izquierdo</div>
            <div className="absolute -top-6 right-0 text-xs font-bold text-slate-400 pointer-events-none">Q2 Superior Derecho</div>
            <div className="absolute -bottom-6 left-0 text-xs font-bold text-slate-400 pointer-events-none">Q3 Inferior Izquierdo</div>
            <div className="absolute -bottom-6 right-0 text-xs font-bold text-slate-400 pointer-events-none">Q4 Inferior Derecho</div>

            <div 
              ref={canvasRef}
              onClick={handleCanvasClick}
              className={`relative w-full h-full bg-white rounded-2xl overflow-hidden shadow-2xl border-2 ${mode === 'edit' ? 'border-dashed border-blue-500/50 cursor-crosshair' : 'border-solid border-[#2a2e3f]'}`}
            >
              {/* Imagen de Fondo */}
              {bgImage ? (
                <img src={bgImage} alt="Pista" className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-80" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                  <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                  <p className="font-semibold text-lg">Sube una imagen para la pista</p>
                  {mode === 'edit' && <p className="text-sm mt-2">Haz clic en el panel inferior para cargar</p>}
                </div>
              )}

              {/* GUÍAS DE CUADRANTES (Arrastrables directamente en el lienzo) */}
              <div 
                className={`guide-handle absolute top-0 bottom-0 w-6 -ml-3 flex justify-center z-10 ${mode === 'edit' ? 'cursor-col-resize hover:bg-black/5' : 'pointer-events-none'}`}
                style={{ left: `${guideX}%` }}
                onMouseDown={(e) => { if (mode === 'edit') { e.stopPropagation(); setDragTarget({type: 'guideX'}); } }}
              >
                <div className="w-0 h-full border-l-4 border-dashed border-red-500/80" />
              </div>
              
              <div 
                className={`guide-handle absolute left-0 right-0 h-6 -mt-3 flex items-center z-10 ${mode === 'edit' ? 'cursor-row-resize hover:bg-black/5' : 'pointer-events-none'}`}
                style={{ top: `${guideY}%` }}
                onMouseDown={(e) => { if (mode === 'edit') { e.stopPropagation(); setDragTarget({type: 'guideY'}); } }}
              >
                <div className="h-0 w-full border-t-4 border-dashed border-red-500/80" />
              </div>
              
              {/* PUNTOS / PIEZAS */}
              {points.map(point => (
                <div
                  key={point.id}
                  className={`point-marker absolute -translate-x-1/2 -translate-y-1/2 rounded shadow-lg flex items-center justify-center font-bold text-xs transition-all
                    ${mode === 'evaluate' ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-grab active:cursor-grabbing'}
                    ${mode === 'edit' && selectedPointId === point.id ? 'ring-2 ring-yellow-400 z-20' : 'z-10'}
                    ${point.isCompleted && mode === 'evaluate' ? 'bg-blue-600 text-white border border-blue-400' : 'bg-[#2a2e3f] text-slate-300 border border-slate-600'}
                  `}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    width: '42px',
                    height: '24px',
                  }}
                  onClick={(e) => handlePointInteraction(e, point.id)}
                  onMouseDown={(e) => handlePointMouseDown(e, point.id)}
                >
                  {point.value}
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* PANEL INFERIOR - HERRAMIENTAS (Dependiendo del modo) */}
        <div className="h-24 bg-[#161925] border-t border-[#2a2e3f] px-6 py-4 flex items-center shrink-0 z-10">
          
          {mode === 'edit' ? (
            // CONTROLES DE EDICIÓN
            <div className="flex w-full items-center justify-between gap-6">
              
              {/* Subir Imagen */}
              <div className="flex items-center gap-4 bg-[#0f111a] px-4 py-2 rounded-xl border border-[#2a2e3f]">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold hover:text-blue-400 transition-colors">
                  <Upload className="w-5 h-5" />
                  <span>Cargar Mapa</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>

              {/* Controles de Guías X/Y */}
              <div className="flex items-center gap-6 bg-[#0f111a] px-6 py-2 rounded-xl border border-[#2a2e3f] flex-1 max-w-xl">
                <span className="text-sm font-semibold text-slate-400 whitespace-nowrap">Guías Cuadrantes:</span>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-red-400">X</span>
                  <input type="range" min="0" max="100" value={guideX} onChange={(e) => setGuideX(e.target.value)} className="w-full accent-red-500 h-1" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-bold text-red-400">Y</span>
                  <input type="range" min="0" max="100" value={guideY} onChange={(e) => setGuideY(e.target.value)} className="w-full accent-red-500 h-1" />
                </div>
              </div>

              {/* Editor del Punto Seleccionado */}
              <div className={`flex items-center gap-3 px-6 py-2 rounded-xl border transition-all ${selectedPointId ? 'bg-blue-900/20 border-blue-500/50' : 'bg-[#0f111a] border-[#2a2e3f] opacity-50'}`}>
                <span className="text-sm font-semibold">Valor Pieza:</span>
                <input 
                  type="number" 
                  value={selectedPointId ? points.find(p => p.id === selectedPointId)?.value || 0 : ''}
                  onChange={(e) => selectedPointId && updatePointValue(selectedPointId, e.target.value)}
                  disabled={!selectedPointId}
                  className="w-20 bg-[#1a1d2d] border border-[#2a2e3f] rounded px-2 py-1 text-center font-bold focus:outline-none focus:border-blue-500"
                />
                <button 
                  onClick={() => selectedPointId && deletePoint(selectedPointId)}
                  disabled={!selectedPointId}
                  className="p-1.5 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded transition-colors disabled:opacity-50"
                  title="Eliminar Pieza"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

            </div>
          ) : (
            // INSTRUCCIONES MODO EVALUACIÓN
            <div className="w-full flex items-center justify-center gap-3 bg-blue-900/20 border border-blue-500/30 text-blue-200 py-3 px-6 rounded-xl">
              <div className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                <span className="font-bold text-sm text-white">i</span>
              </div>
              <p className="text-sm font-medium">
                Instrucciones: Pulsa sobre cada pieza del mapa para marcarla como completada. El sistema calcula automáticamente el puntaje y el porcentaje de recorrido para el ranking.
              </p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}