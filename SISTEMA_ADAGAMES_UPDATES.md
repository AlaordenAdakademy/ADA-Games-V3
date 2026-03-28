# Adagames Robotics Quest - Bitácora de Sistema y Actualizaciones

Este documento detalla las funcionalidades principales y la evolución del sistema Adagames desde un tablero local hasta una plataforma de competencia profesional y colaborativa.

## 🛠️ Funcionalidades del Sistema (Core)

1.  **Gestión de Equipos**: Registro, inspección de hardware y seguimiento de estados (Pendiente, Inspeccionado, Descalificado).
2.  **Configurador de Mapas**: Diseño dinámico de pistas de competencia con puntos de ruta y obstáculos.
3.  **Evaluación de Competencia**: Interfaz de juez para asignar puntos en tiempo real con soporte para Bonos.
4.  **Ranking Global**: Tabla de posiciones automática basada en puntajes acumulados.
5.  **Persistencia Centralizada**: Backend en FastAPI que guarda todos los datos en `data.json` y `users.json`.

---

## 📅 Historial de Actualizaciones (Changelog)

### v2.0 - Migración de Arquitectura
- **Backend FastAPI**: Sustitución de almacenamiento local volátil por un servidor persistente.
- **Sincronización Multidispositivo**: Los datos ahora se guardan en el servidor, permitiendo que varios dispositivos (PCs, tablets, celulares) vean lo mismo.

### v3.0 - Los 4 Pilares de Misión Crítica
1.  **Trazabilidad (Audit)**: Cada punto guardado incluye el identificador y nombre del juez responsable.
2.  **Reglas de Negocio (Collision Lock)**: Bloqueo automático de evaluaciones duplicadas para evitar errores humanos.
3.  **Sincronización en Tiempo Real**: Implementación de `Storage Events` para actualización instantánea entre pestañas.
4.  **Historial de Admin**: Modal de auditoría que permite al Administrador ver el desglose minuto a minuto de cada equipo.

### v3.1 - Seguridad y Control de Usuarios
- **Authentication Flow**: Nuevo portal de acceso con lista desplegable de usuarios y validación de contraseña.
- **JSON User Management**: Gestión centralizada de credenciales en un archivo `users.json` editable.
- **Cierre de Sesión**: Implementación de limpieza de sesión en todas las pestañas simultáneamente.

### v3.2 - Modo Televisión y Polish Final
- **Modo Competencia (TV View)**: Interfaz de pantalla completa para proyectar el ranking con diseño de alto contraste.
- **Cronómetro Regresivo (30 Min)**: Temporizador oficial de competencia sincronizado globalmente.
- **Refactorización UI**: Botón de cierre de sesión movido a la parte inferior de la barra lateral.

### v4.0 - Escalabilidad Multi-Categoría
- **Motor Dual de Competencia**: Soporte nativo para "Robotics Quest" y "Seguidor de Línea".
- **Filtrado Dinámico**: Backend y frontend separados por categoría.

### v4.2 - Optimización Seguidor de Línea
- **Cronómetro Regresivo (2:00)**: El tiempo ahora descuenta desde los 2 minutos, con alerta visual (rojo/parpadeo) en los últimos 10 segundos.
- **Registro de Tiempo Transcurrido**: Guardado automático del tiempo real de ejecución (Tiempo Límite - Tiempo Restante).
- **Ranking Robusto**: Mejora en la visualización de Porcentaje y Tiempo con fallbacks automáticos para evitar celdas vacías.

---

## 📁 Estructura del Proyecto
- `backend/main.py`: Lógica del servidor y APIs.
- `backend/data.json`: Base de datos de equipos y pistas.
- `backend/users.json`: Base de datos de usuarios y permisos.
- `frontend/app.js`: Cerebro React de la aplicación (SPA).
- `frontend/index.html`: Cascarón visual optimizado con Tailwind CSS.

---
*Adagames Robotics Quest System - 2026*
