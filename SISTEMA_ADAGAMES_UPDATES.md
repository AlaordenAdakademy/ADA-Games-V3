# Adagames Robotics Quest - Bitácora de Sistema y Actualizaciones

Este documento detalla las funcionalidades principales y la evolución del sistema Adagames desde un tablero local hasta una plataforma de competencia profesional y colaborativa.

## 🛠️ Funcionalidades del Sistema (Core)

1.  **Gestión de Equipos**: Registro, inspección de hardware y seguimiento de estados (Pendiente, Inspeccionado, Descalificado).
2.  **Configurador de Mapas**: Diseño dinámico de pistas de competencia con puntos de ruta y obstáculos.
3.  **Evaluación de Competencia**: Interfaz de juez para asignar puntos en tiempo real con soporte para Bonos.
4.  **Ranking Global**: Tabla de posiciones automática basada en puntajes acumulados.
5.  **Gestión Dinámica de Usuarios**: Interfaz para añadir y eliminar jueces con persistencia inmediata en `users.json`.

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
- **Cronómetro Regresivo (2:00)**: Tiempo límite oficial con alerta visual.
- **Registro de Tiempo Transcurrido**: Guardado automático del tiempo real de ejecución.

### v4.3 - Parche de Estabilidad y Persistencia
- **Prevención de Pantalla en Blanco**: Solucionado error de renderizado por datos nulos.
- **Merged-Update en Backend**: El guardado de equipos ahora preserva los datos de otras categorías.

### v4.4 - Versión Final Estable
- **Restauración Total de Flujo (Login)**: Re-implementación de lógica de acceso.
- **Categorización de Datos**: Migración completa de `data.json`.

### v4.5 - Configuración de Servidor de Red
- **Logs de Servidor**: El backend ahora imprime claramente las direcciones de acceso local y de red al iniciar.
- **Acceso WiFi**: Los jueces pueden conectarse desde cualquier dispositivo en la misma red usando la URL generada.

### v4.6 - Gestión de Usuarios desde Panel
- **Módulo de Administración de Jueces**: Nueva sección en la barra lateral exclusiva para el administrador.
- **CRUD de Jueces**: El administrador ahora puede añadir nuevos jueces con nombre y contraseña, y eliminar cuentas existentes directamente desde la interfaz.
- **Persistencia en Tiempo Real**: Las modificaciones en la lista de usuarios se guardan instantáneamente en `users.json`, actualizando el portal de acceso sin necesidad de reiniciar el servidor.
- **Protección de Seguridad**: Bloqueo incorporado para evitar la auto-eliminación de la cuenta de administrador central.

### v4.7 - Registro de Equipos y Miembros
- **Gestión de Integrantes**: Ampliación del formulario de registro para incluir nombres de los miembros del equipo.
- **Campos Dinámicos**: Soporte para añadir y eliminar hasta 3 integrantes por equipo directamente en la interfaz de registro.
- **Persistencia Extendida**: Se ha actualizado la estructura de datos para almacenar el nombre del equipo y su lista de participantes.

---

## 📁 Estructura del Proyecto
- `backend/main.py`: Lógica del servidor y APIs.
- `backend/data.json`: Base de datos de equipos y pistas.
- `backend/users.json`: Base de datos de usuarios y permisos.
- `frontend/app.js`: Cerebro React de la aplicación (SPA).
- `frontend/index.html`: Cascarón visual optimizado con Tailwind CSS.

---
*Adagames Robotics Quest System - 2026*
