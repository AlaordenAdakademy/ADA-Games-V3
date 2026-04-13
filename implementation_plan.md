# Integración de Evaluador de Pistas en ADAGAMES

Esta implementación refactorizará el código proporcionado (`app.jsx`) y lo integrará dentro del layout principal del sistema (`frontend/app.js`).

## Cambios Propuestos

### 1. Actualización del Menú Lateral (Sidebar)
Se modificará la barra lateral en `frontend/app.js`:
- Se cambiará/asegurará la existencia del ítem "Configurar Pista" entre "Inspección" y "Evaluación".
- Se usará el ícono `map` de lucide-react para identificarlo.

### 2. Gestión de Estado Global
- Se subirán los estados `bgImage`, `points`, `guideX`, y `guideY` al componente principal `App` en `frontend/app.js`.
- Esto permitirá navegar entre las secciones "Configurar Pista" y "Evaluación" sin que el mapa o los puntos se reinicien.

### 3. Adaptación de `EvaluadorDePistas`
- Se transpilara mentalmente el uso de `import` (React, lucide) a usar el objeto global de React y el componente `<Icon />` que usa el sistema actual (CDN en el navegador).
- El componente se renombrará a `EvaluadorDePistas` y se insertará en `frontend/app.js`.
- Se añadirá la propiedad `initialMode` para recibir `'edit'` o `'evaluate'`.
- La barra superior (Header de cambio de modo) será eliminada ya que la navegación la hace el Sidebar.
- La clase del contenedor padre se cambiará de `h-screen` a `h-full w-full` para ajustarse al layout de ADAGAMES.

### 4. Renderizado Condicional
- En `activeTab === 'config'`, se renderizará `<EvaluadorDePistas initialMode="edit" />`. En este caso **no** se mostrará la "Mesa del Juez".
- En `activeTab === 'evaluacion'`, se renderizará `<EvaluadorDePistas initialMode="evaluate" />`. Aquí **sí** se incluirá la "Mesa del Juez".

## Dudas Abiertas
- Actualmente `frontend/app.js` tiene un sistema intrincado de puntuación (`teams`, `tracks`, etc.) y componentes como `EvaluacionTab` y `ConfigTab`. ¿Debo reemplazar por completo el `<EvaluacionTab>` y `<ConfigTab>` actual del ADAGAMES por tu nuevo `EvaluadorDePistas` para todos los casos (o solo para Robotics Quest)? Se asumirá que reemplaza a los de Quest.
- Se mantendrá el guardado de los resultados local en la variable global, esperando futura conexión formal con `addScore` y las rondas del Sidebar.

Se requiere tu confirmación para proceder con la incrustación y refactorización en `frontend/app.js`.
