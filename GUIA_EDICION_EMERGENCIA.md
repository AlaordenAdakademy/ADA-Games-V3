# Guía de Edición de Emergencia: `data.json`

Esta guía explica cómo modificar directamente la base de datos `data.json` en casos extremos (como fallos en el sistema, correcciones de jueces en diferido, o eliminación de intentos accidentales) para que los cambios se reflejen correctamente en el Ranking de la aplicación.

> [!WARNING]
> **Precaución:** Editar `data.json` a mano puede romper la aplicación si te equivocas con las comas o llaves. **Siempre haz una copia del archivo (`data.json.bak`) antes de editarlo.**

---

## 1. Estructura Básica de un Equipo
Si abres `data.json`, verás una lista de todos los equipos dentro del arreglo `"teams"`. Cada equipo tiene esta estructura básica:

```json
{
  "id": "123456",
  "teamName": "Don Bosco Tech",
  "category": "line_follower",
  "history": [
    // Aquí están todos los intentos registrados
  ]
}
```

Lo que **define los puntos en el Ranking** es el contenido del arreglo `"history"`.

---

## 2. Cómo Modificar un Intento Existente (Puntaje y Tiempo)

Supongamos que el juez se equivocó y Don Bosco Tech hizo **100 puntos en 10.5 segundos** en lugar de lo que dice el sistema para la Ronda 1, Pista 1.

1. Busca el nombre del equipo (`"Don Bosco Tech"`).
2. Dentro de ese equipo, busca su arreglo `"history"`.
3. Encuentra el bloque que corresponda a la ronda y pista deseada:

```json
{
  "ronda": 1,
  "pista": 1,
  "points": 80,          // <-- CAMBIAR ESTO A 100
  "finalTimeMs": 15000,  // <-- CAMBIAR ESTO (10.5s = 10500 ms)
  "voided": false,
  "practice": false,
  "date": "10:30:00 AM",
  "judgeId": "1",
  "judgeName": "Juez 1"
}
```
**Regla del tiempo:** El tiempo se guarda en **milisegundos**. Si el tiempo oficial es `10.5` segundos, debes multiplicar por 1000: `10500`.

---

## 3. Cómo Eliminar ("Quitar") un Intento

Si se registró un intento por error y quieres que el sistema haga de cuenta que **nunca ocurrió** (para devolverle la oportunidad al equipo):

Simplemente **borra todo el bloque** correspondiente a ese intento dentro del `"history"`, asegurándote de no dejar una coma sobrante.

**Antes:**
```json
"history": [
  {
    "ronda": 4,
    "pista": 1,
    "points": 120,
    "finalTimeMs": 45000,
    "voided": false
  },
  {
    "ronda": 4,
    "pista": 2,
    "points": 50,
    "finalTimeMs": 10000,
    "voided": false
  }
]
```

**Después (Eliminando el intento de la pista 1):**
```json
"history": [
  {
    "ronda": 4,
    "pista": 2,
    "points": 50,
    "finalTimeMs": 10000,
    "voided": false
  }
]
```
*(Nota que se quitó la coma que separaba los dos bloques).*

---

## 4. Cómo Anular un Intento sin Borrarlo (Intento Nulo)

Si quieres que un intento cuente como "consumido" pero que dé **0 puntos** (Intento Nulo):

Cambia el valor de `"voided"` a `true` y pon los puntos y tiempos a `0`:
```json
{
  "ronda": 4,
  "pista": 1,
  "points": 0,
  "finalTimeMs": 0,
  "voided": true,     // <-- El motor ignorará este intento para puntajes
  "practice": false
}
```

---

## 5. Cómo Añadir ("Poner") un Intento Manualmente

Si la red falló y anotaste un intento en papel, puedes insertarlo manualmente en el `data.json`.
Copia el siguiente bloque, edita los valores y **pégalo al final de la lista `"history"`** del equipo.

```json
{
  "ronda": 2,
  "pista": 1,
  "points": 100,
  "finalTimeMs": 12000,
  "percentage": "100.0",
  "voided": false,
  "practice": false,
  "date": "14:00:00 PM",
  "judgeId": "admin",
  "judgeName": "Administrador"
}
```
> [!IMPORTANT]
> **El Motor "Mejor de 3" (Sigue Líneas):** Si agregas 4 o más intentos para la misma pista y ronda en Seguidor de Línea, el sistema evaluará **todos los que no sean nulos (`voided: false`)** y tomará el mejor puntaje. Sin embargo, en la interfaz del juez, el equipo aparecerá como "Bloqueado / Ya Evaluado" si detecta 3 o más intentos en su historial.

---

## Resumen de Propiedades Críticas
*   `ronda`: (1, 2, 3, 4, 5) La ronda del torneo.
*   `pista`: (1, 2, 3) Número de la pista física. Para Quest global a veces se usa `0`.
*   `points`: Puntaje oficial bruto del intento.
*   `percentage`: (Solo útil en algunas ramas de Quest) El % de completación.
*   `finalTimeMs`: El tiempo oficial incluyendo penalizaciones, medido en milisegundos (`segundos x 1000`).
*   `voided`: `true` o `false`. Determina si es un Intento Nulo.
*   `practice`: Si es `true`, el motor de Ranking **ignorará** este intento. Siempre debe estar en `false` para resultados oficiales.

## Pasos para aplicar los cambios:
1. Guarda el archivo `data.json`.
2. Ve a tu navegador y recarga la aplicación web (F5).
3. Los cambios se verán reflejados de inmediato en el Ranking.
4. Si estás sincronizando, haz un commit y push a GitHub para que los demás equipos reciban el archivo modificado.
