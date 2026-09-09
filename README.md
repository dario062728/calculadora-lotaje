# Bloqueo Operativo — Artalia Trading

Frená la sobreoperativa: cargás tu plan de trading del día con anticipación y, una vez que lo cumplís (o decidís que ya operaste suficiente), se bloquea el acceso para que no puedas "una más".

Hay tres formas de usarlo, según cuánto bloqueo real necesitás:

| | ¿Qué bloquea? | ¿Qué necesitás? |
|---|---|---|
| **`desktop-app/`** (recomendado) | El sitio web **y** apps de escritorio (ej. TradingView desktop) que usen ese dominio, en toda tu computadora | Tener Node.js instalado, ejecutar un launcher (pide contraseña de administrador) |
| **`extension/`** | Solo pestañas del navegador donde esté instalada | Instalar una extensión en Chrome/Edge |
| **`index.html`** (app web) | Nada externo — solo bloquea sus propios botones, como recordatorio de disciplina | Nada, se abre en cualquier navegador |

**Si tenés la app de escritorio o del celular de TradingView (como es tu caso), usá `desktop-app/`** — es la única de las tres que puede bloquear algo fuera del navegador.

Las tres son independientes entre sí (no comparten el plan ni las estadísticas).

## `desktop-app/` — bloqueo real (web + apps de escritorio)

### Cómo funciona

Corre un pequeño servidor en tu propia computadora (nunca sale a internet, ni se conecta a nada externo). Cuando tu plan se completa, edita el archivo `hosts` de tu sistema operativo para que el dominio que elegiste (ej. `tradingview.com`) deje de resolver — eso corta tanto la pestaña del navegador como la app de escritorio, porque ambas dependen de resolver ese mismo dominio para conectarse. Por eso pide contraseña de administrador: es el mismo permiso que necesita cualquier bloqueador de sitios real (Cold Turkey, Freedom, etc.).

1. **Estadísticas**: arriba de todo, siempre visible — resultado de la semana y resultado + operaciones totales (histórico, con % de aciertos).
2. **Plan del día**: balance, riesgo por operación, máximo de operaciones, pérdida máxima diaria, objetivo de ganancia (opcional) y los sitios/dominios a bloquear. Al confirmar, queda fijo por el resto del día.
3. **Sesión en curso**: vas registrando cada operación ejecutada (resultado + P&L) contra el plan.
4. **Bloqueo automático**: al tocar cualquier límite del plan (o marcar "plan completado" manualmente), bloquea los dominios configurados en todo el sistema y muestra una pantalla con el resumen del día.
5. **Reinicio**: se desbloquea solo al otro día de trading. El plan queda como plantilla, pero hay que reconfirmarlo.
6. **Desbloqueo de emergencia**: requiere escribir una frase exacta definida por vos. Queda registrado para siempre en tu historial de disciplina.

### Instalación y uso

1. **Instalá Node.js** (una sola vez): entrá a [nodejs.org](https://nodejs.org), descargá la versión **LTS** (botón verde) e instalala como cualquier programa (siguiente, siguiente, finalizar).
2. Descomprimí este repositorio y entrá a la carpeta `desktop-app/`.
3. **Windows**: doble clic en `start-windows.bat`. Va a pedir permiso de administrador (aceptá) — se abre una ventana de Windows, confirmá.
   **Mac**: doble clic en `start-mac.command`. Se abre una Terminal pidiendo tu contraseña (la del usuario de la Mac) — escribila y Enter (no se ve mientras escribís, es normal).
4. Se abre solo el navegador en `http://localhost:5757` con la app.
5. Para usarla de nuevo otro día, volvé a hacer doble clic en el mismo launcher.

Si ves un cartel amarillo/rojo arriba de la app diciendo que no se pudo bloquear a nivel de sistema, cerrá todo y volvé a abrir el launcher (paso 3) — seguramente se ejecutó sin permisos de administrador.

### Tu app del celular (TradingView u otra)

Ninguna herramienta que corra en tu computadora puede bloquear apps de tu teléfono — son dispositivos separados. Para eso usás la función que ya trae el celular:

- **iPhone**: Ajustes → Tiempo de Uso → Límites de Apps → elegís TradingView → ponés un límite de 0 minutos para después de tu horario de trading.
- **Android**: Ajustes → Bienestar Digital → Temporizadores de apps → TradingView → mismo criterio.

Es un paso manual de 2 minutos, una sola vez.

## `extension/` — solo navegador

Mismo concepto de plan/sesión/bloqueo, pero implementado como extensión de Chrome/Edge/Brave: bloquea la navegación *dentro del navegador* hacia los sitios que configures (no toca apps de escritorio ni el celular). Útil si solo te sobreopera por pestañas del navegador y no querés instalar Node.

**Instalación**: `chrome://extensions` → activar "Modo de desarrollador" → "Cargar descomprimida" → seleccionar la carpeta `extension/`.

Más detalle en los comentarios del propio código (`extension/manifest.json`, `extension/popup.js`).

## `index.html` — app web instalable, sin bloqueo real

Página instalable como app desde el navegador (botón "Instalar app"), con el mismo plan/sesión, pero **sin poder bloquear nada externo** — solo deshabilita sus propios botones al completar el plan, como recordatorio de disciplina. Sirve si solo querés el seguimiento, sin instalar Node ni una extensión.

## Estructura

```
desktop-app/                     App de escritorio: bloqueo real (recomendada)
  server.js                      Servidor local (Node, sin dependencias externas)
  state-store.js                 Plan, sesión, bloqueo, historial y estadísticas (archivo JSON local)
  hosts-blocker.js               Edita el archivo hosts del sistema de forma segura (solo su propio bloque marcado)
  public/                        Interfaz (HTML/CSS/JS)
  start-windows.bat, start-mac.command   Launchers de doble clic

extension/                       Extensión de navegador (bloqueo solo en el navegador)
index.html, app.css, app.js      App web instalable (sin bloqueo real)
```

---

*Herramienta educativa, no es asesoramiento financiero.*
