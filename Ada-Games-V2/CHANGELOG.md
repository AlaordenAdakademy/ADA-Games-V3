# ADAGAMES — Historial de Cambios (CHANGELOG)

> Sistema de gestión de competencias robóticas para las categorías **Robotics Quest** y **Line Follower**.

---

## v4.5 — 2026-04-11

### 🐛 Corrección Crítica: Corrupción de `data.json`
- **Causa raíz:** El frontend llamaba `addTeam()` N veces en bucle → N peticiones `POST /api/teams` simultáneas → condición de carrera que corrompía el JSON en disco.
- **Fix Backend — Escritura Atómica:** `save_data()` ahora escribe en un archivo temporal (`.tmp`) y luego lo renombra al destino final. El renombrado es una operación atómica del sistema operativo, imposible de dejar a medias.
- **Fix Backend — Threading Lock:** Se añadió un `threading.Lock()` global (`_data_lock`) que serializa todas las operaciones de lectura/escritura. Solo una petición puede acceder al archivo a la vez.
- **Fix Backend — Endpoint Bulk:** Nuevo `POST /api/teams/bulk` que recibe todos los equipos nuevos en una sola petición y los guarda en una única operación atómica. Elimina la necesidad de N peticiones paralelas.
- **Fix Frontend — `bulkAddTeams`:** La función `confirmImport` ahora usa `bulkAddTeams()` (una sola llamada de API) en lugar de iterar con `addTeam()`.
- **Fix Backend — Encoding UTF-8:** `load_data()` ahora abre el archivo con `encoding='utf-8'` explícito para evitar `UnicodeDecodeError` en Windows (que usa cp1252 por defecto).

### ✨ Nueva Funcionalidad: Importación Masiva por Excel/CSV
- **Sección de Importación** en `RegistroTab` (ambas categorías — Quest y Line Follower).
- **Botón "Descargar Plantilla (.csv)":** Genera y descarga al instante un archivo `.csv` modelo compatible con el sistema.
- **Botón "Importar Archivo (.xlsx / .csv)":** Lee archivos Excel o CSV usando la librería SheetJS (CDN).
- **Vista Previa Modal:** Antes de confirmar, muestra todos los equipos detectados con indicador ✅ válido / ❌ incompleto.
- **Validación:** Solo se importan equipos que tengan **Nombre** y **Capitán** definidos.

### 📋 Mejoras al Registro Manual
- Nuevo campo **Coach / Entrenador** en el formulario de registro.
- 3 campos individuales para **Integrantes** (máx. 3 por reglamento).
- Los datos se guardan en el equipo: `captainName`, `coachName`, `members[]`.
- Los nombres de integrantes son necesarios para la **emisión de certificados**.

### 📄 Plantilla CSV Compatible
- Columnas: `Nombre Equipo | Colegio | Capitan | Coach | Integrante 1 | Integrante 2 | Integrante 3`
- Compatible con Microsoft Excel, Google Sheets y LibreOffice Calc.
- Archivo de prueba incluido: `frontend/test_equipos.csv` (10 colegios ficticios).

### 🔧 Dependencias Agregadas
- `SheetJS v0.20.2` vía CDN en `index.html` para parseo de Excel en el navegador.
- `threading` (stdlib de Python) en `main.py` para el lock de escritura.
- `tempfile` (stdlib de Python) en `main.py` para escritura atómica.

---

## v4.2 — 2026-04-11 (sesión anterior)

### ✨ Sistema de Auditoría de Evaluaciones
- **Panel de Auditoría** integrado en el `HistorialModal` — solo visible para administradores.
- Permite **eliminar evaluaciones erróneas** de cualquier equipo.
- Al eliminar una evaluación, el sistema **recalcula automáticamente** el `score` total y `lastTime` del equipo en tiempo real.
- Los cambios se sincronizan para todos los dispositivos conectados.

### ✨ Reset Global Protegido
- Botón de **"Aniquilar Competencia"** disponible solo para administradores.
- Requiere ingreso de la **contraseña de administrador** para confirmar.
- Genera un **respaldo automático** en `backend/backups/data_backup_YYYYMMDD_HH-MM-SS.json` antes de borrar.
- Endpoint: `POST /api/reset` con validación de credenciales.

### ✨ Sincronización de Tiempo Global (Timer de 30 min)
- **Backend:** Endpoints `GET /api/timer` y `POST /api/timer` para mantener el estado del temporizador de ronda.
- **Frontend:** Todos los dispositivos conectados sincronizan el mismo reloj de 30 minutos por ronda.
- El estado del timer persiste en `data.json` y sobrevive reinicios del servidor.

### ✨ Lógica de Tiempo por Categoría
- **Robotics Quest:** El tiempo del equipo se captura automáticamente al guardar la **Pista 5**. El tiempo registrado = `30min - tiempo_restante`. Si el equipo no completa las 5 pistas, se asigna el tiempo máximo (30:00.00) en el ranking.
- **Line Follower:** Mantiene su cronómetro independiente de 2 minutos por intento. El reloj de 30 min solo funciona como referencia de jornada.

---

## v4.0 — 2026-04-10 (sesión anterior)

### ✨ Configuración de Bonus en Quest
- En la sección **Configuración de Pistas** (Quest), cada pista ahora permite configurar:
  - **Punto de inicio del Bonus** (`bonusStart`) — coordenada en el tablero.
  - **Dirección de orientación** (`bonusDir`) — flechas N ⬆, S ⬇, E ➡, O ⬅.
  - **Reglas del Bonus** (`bonusRules`) — texto libre con las condiciones específicas.
- En la pantalla de evaluación, se muestra el panel de bonus **solo si el equipo decide intentarlo**.
- El juez debe confirmar la **intención de bonus** (Sí/No) antes de poder activar el botón de resultado.
- La estrella ⭐ indica la casilla de inicio del bonus en el tablero.

### 🐛 Corrección: Pantalla en Blanco tras F5
- Se identificaron y corrigieron múltiples errores de sintaxis en `app.js`:
  - Llaves de cierre duplicadas en `resetTimer`.
  - Funciones mal cerradas que rompían el árbol de componentes de React.
- Se corrigió el paso de `props` (`timer`) hacia `EvaluacionTab` que causaba referencias indefinidas.

### ✨ Auto-scroll en Vista TV (`CompetitionOverlay`)
- El ranking de la vista TV se desplaza automáticamente hacia abajo y rebota al llegar al final.
- Botón de toggle "▶ Auto-scroll" para activar/desactivar.
- Implementado con `requestAnimationFrame` para máxima fluidez (evita saltos de `setInterval`).

---

## v3.5 — 2026-03-28 (sesiones anteriores)

### ✨ Categoría Line Follower — Evaluador de Pistas
- Componente `EvaluadorDePistas` con mapa interactivo de puntos.
- Modo **Edición:** Carga imagen de fondo, coloca puntos con valor, define guías de cuadrantes (Q1–Q4).
- Modo **Evaluación:** El juez marca puntos completados, gestiona intentos (máx. 3), controla el cronómetro de 2 minutos y registra penalizaciones (+5s cada una).
- Subida de imágenes de mapa al servidor: `POST /api/upload_map`.

### ✨ Arquitectura Multi-categoría
- Sistema de autenticación con roles: `admin`, `judge`.
- Categorías separadas: `quest` y `line_follower`.
- Filtrado de equipos y datos por categoría en todos los endpoints.
- El polleo de datos (`/api/data?category=...`) actualiza el estado global cada 5 segundos.

### ✨ Vista de Competencia (TV)
- Pantalla `CompetitionOverlay` para proyectar en pantalla grande.
- Ranking en tiempo real, timer global, controles de inicio/pausa/reset de ronda.

---

## v2.0 — 2026-03-27 (versión base)

### Funcionalidades Iniciales
- Registro de equipos con nombre de institución y capitán.
- Inspección y aprobación de equipos (estado `pending` → `inspected`).
- Evaluación básica de pistas con tablero de cuadrículas (A-J × 1-6) para Quest.
- Sistema de puntaje y ranking con criterios: mayor puntaje primero, menor tiempo como desempate.
- Historial de evaluaciones por equipo.
- Backend FastAPI + almacenamiento en `data.json` (sin base de datos).
- Frontend React (Babel in-browser) con Tailwind CSS via CDN.
