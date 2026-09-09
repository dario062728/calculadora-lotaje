# Bloqueo Operativo — Artalia Trading

Dos herramientas para operar con más disciplina y frenar la sobreoperativa: cargás tu plan de trading con anticipación y, una vez que lo cumplís, se bloquea el acceso para que no puedas "una más".

1. **App instalable** (`index.html` + `app.js` + `app.css`) — plan del día, calculadora de lotaje, seguimiento de operaciones y autobloqueo de sus propios controles. Se instala como app de escritorio desde el navegador, sin terminal ni dependencias.
2. **`extension/`** — extensión de navegador que además bloquea de verdad el acceso a los sitios que elijas (tu bróker, tu plataforma de gráficos, etc.) una vez cumplido el plan.

Las dos comparten el mismo diseño y la misma lógica de plan/sesión, pero **no comparten datos entre sí** (la app usa `localStorage` del navegador, la extensión usa su propio almacenamiento) — son dos herramientas complementarias, no una sincronizada con la otra.

## App instalable (`index.html`)

### Instalar en el escritorio

1. Abrí `index.html` con Chrome o Edge (podés simplemente hacer doble clic en el archivo, o servirlo desde cualquier hosting estático / GitHub Pages).
2. Va a aparecer un botón **"📲 Instalar app"** arriba a la derecha (o el ícono de instalar en la barra de direcciones). Hacé clic e instalala.
3. Te va a quedar un ícono propio en el escritorio / menú de aplicaciones, que abre la app en su propia ventana, sin barra de navegador.

No requiere Node, ni build, ni permisos especiales — es una PWA (Progressive Web App) estándar.

### Cómo funciona

1. **Plan del día**: antes de operar, cargás balance, riesgo por operación, máximo de operaciones, pérdida máxima diaria, objetivo de ganancia (opcional) y, opcionalmente, una lista de sitios a evitar (queda como recordatorio visual, ver limitación más abajo). Al confirmar, esos valores quedan fijos por el resto del día.
2. **Sesión en curso**: calculadora de lotaje (Forex, Oro, Plata, BTC/USD, índices; modo por pips o por precio de entrada/stop) usando el riesgo ya fijado por el plan, y un registro de operaciones ejecutadas.
3. **Autobloqueo**: en cuanto se cumple cualquier límite del plan, o marcás "plan completado", la app bloquea su propia interfaz (no podés seguir calculando lotajes ni "planificar una más") y muestra una pantalla de bloqueo con el resumen del día.
4. **Reinicio**: al otro día de trading se desbloquea solo; el plan queda como plantilla pero hay que reconfirmarlo.
5. **Desbloqueo de emergencia**: requiere escribir una frase exacta definida por vos mismo. Queda registrado permanentemente como historial de disciplina.

### Limitación importante

Como es una página web (aunque esté instalada como app), **no puede impedir que abras otras páginas o aplicaciones** — solo bloquea sus propios controles. Los "sitios a evitar" que cargás en el plan son solo un recordatorio visual en la pantalla de bloqueo, no un bloqueo real. Para bloqueo real de sitios, instalá también la extensión de navegador (`extension/`).

## Extensión de navegador (`extension/`) — bloqueo real de sitios

### Cómo funciona

Mismo concepto de plan/sesión/autobloqueo que la app, pero además bloquea de verdad: cuando se cumple el plan, redirige cualquier intento de entrar a los sitios que configuraste hacia una pantalla de bloqueo, hasta tu próxima sesión.

### Instalación (Chrome / Edge / Brave — navegadores basados en Chromium)

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá "Modo de desarrollador" (arriba a la derecha).
3. Elegí "Cargar descomprimida" (Load unpacked) y seleccioná la carpeta `extension/` de este repositorio.
4. Va a aparecer el ícono 🔒 en la barra de extensiones. Abrilo para cargar tu plan del día.

Al cargarla vas a ver el permiso "Leer y cambiar tus datos en todos los sitios web": es necesario porque la extensión no sabe de antemano qué sitios vas a querer bloquear (los definís vos), y ese es el permiso que Chrome exige para poder redirigir la navegación a *cualquier* dominio que elijas. La extensión no lee ni envía el contenido de los sitios que visitás — solo intercepta la navegación hacia los dominios que vos cargaste en el plan.

### Limitaciones (a propósito)

- Bloquea navegación **dentro del navegador** hacia los dominios que configuraste. No cierra ni bloquea aplicaciones nativas instaladas en tu computadora o celular (MetaTrader de escritorio, apps móviles, etc.) — eso requeriría una app nativa con permisos de sistema operativo (tipo control parental).
- Pensada para Chrome/Edge/Brave (Manifest V3). Firefox soporta una versión de Manifest V3 pero con diferencias en el `background`; no está probado en este repo.
- Cada perfil de navegador donde la instales tiene su propio plan y su propio historial — no se sincroniza entre dispositivos ni con la app instalable.

## Estructura

```
index.html, app.css, app.js      App instalable (PWA): plan, calculadora, sesión y autobloqueo
manifest.webmanifest, sw.js      Metadata e instalabilidad de la PWA
icons/                            Íconos de la PWA (16 a 512px)

extension/
  manifest.json                  Manifest V3: permisos, popup, background, recursos accesibles
  js/state.js                    Modelo de estado (plan, sesión, bloqueo, historial)
  background.js                  Service worker: aplica/retira las reglas de bloqueo (declarativeNetRequest)
  popup.html/.css/.js            Setup del plan, seguimiento de sesión y vista de bloqueo
  blocked.html/.css/.js          Pantalla que ve el usuario al entrar a un sitio bloqueado
  icons/                         Íconos de la extensión
```

---

*Herramienta educativa, no es asesoramiento financiero.*
