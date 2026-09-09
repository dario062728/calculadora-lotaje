# Calculadora de Lotaje + Bloqueo Operativo — Artalia Trading

Dos herramientas para operar con más disciplina:

1. **`index.html`** — calculadora de lotaje standalone (abrí el archivo en el navegador, no necesita instalación).
2. **`extension/`** — extensión de navegador que bloquea el acceso a los sitios que elijas (tu bróker, tu plataforma de gráficos, etc.) una vez que cumpliste el plan de trading que cargaste con anticipación. Así se frena la sobreoperativa: no podés "una más" después de terminar tu plan, porque el sitio queda bloqueado hasta la próxima sesión.

## Calculadora de lotaje (`index.html`)

Calcula el tamaño de posición según tu balance, riesgo por operación y distancia del stop loss, con soporte para Forex, Oro, Plata, BTC/USD e índices (valores de pip/punto editables, ya que dependen de cada bróker). Incluye modo "por pips" y "por precio de entrada/stop", relación riesgo/beneficio opcional y barra de nivel de riesgo.

No requiere instalación: abrí `index.html` en cualquier navegador, o publicalo con GitHub Pages / cualquier hosting estático.

## Bloqueo Operativo (`extension/`)

### Cómo funciona

1. **Plan del día**: antes de operar, cargás balance, riesgo por operación, máximo de operaciones, pérdida máxima diaria, objetivo de ganancia (opcional) y los sitios a bloquear. Al confirmar, esos valores quedan fijos por el resto del día — no se pueden editar sin pasar por el desbloqueo de emergencia.
2. **Sesión en curso**: calculadora de lotaje para la próxima operación (con el riesgo ya fijado por el plan) y un registro de operaciones ejecutadas (resultado + P&L).
3. **Bloqueo automático**: en cuanto se cumple cualquiera de los límites del plan (máximo de operaciones, pérdida máxima o objetivo de ganancia) — o marcás manualmente "plan completado" — la extensión bloquea el acceso a los sitios configurados, redirigiéndolos a una pantalla de bloqueo con el resumen de la sesión.
4. **Reinicio**: el bloqueo se levanta solo, automáticamente, en tu próxima sesión de trading (día calendario siguiente). El plan queda como plantilla editable, pero hay que confirmarlo de nuevo cada día — ese acto de recompromiso es intencional.
5. **Desbloqueo de emergencia**: si de verdad necesitás entrar antes de tiempo, podés hacerlo escribiendo una frase exacta que vos mismo definiste al armar el plan. Queda registrado permanentemente (fecha y hora) y se muestra como estadística de disciplina ("vas N veces rompiendo el plan antes de tiempo"), sin forma de borrarlo. La fricción es a propósito.

### Instalación (Chrome / Edge / Brave — navegadores basados en Chromium)

1. Abrí `chrome://extensions` (o `edge://extensions`).
2. Activá "Modo de desarrollador" (arriba a la derecha).
3. Elegí "Cargar descomprimida" (Load unpacked) y seleccioná la carpeta `extension/` de este repositorio.
4. Va a aparecer el ícono 🔒 en la barra de extensiones. Abrilo para cargar tu plan del día.

Al cargarla vas a ver el permiso "Leer y cambiar tus datos en todos los sitios web": es necesario porque la extensión no sabe de antemano qué sitios vas a querer bloquear (los definís vos), y ese es el permiso que Chrome exige para poder redirigir la navegación a *cualquier* dominio que elijas. La extensión no lee ni envía el contenido de los sitios que visitás — solo intercepta la navegación hacia los dominios que vos cargaste en el plan.

### Limitaciones (a propósito)

- Bloquea navegación **dentro del navegador** hacia los dominios que configuraste (ej. la plataforma web de tu bróker). No cierra ni bloquea aplicaciones nativas instaladas en tu computadora o celular (MetaTrader de escritorio, apps móviles, etc.) — eso requeriría una app nativa con permisos de sistema operativo (tipo control parental), fuera del alcance de una extensión de navegador.
- Pensada para Chrome/Edge/Brave (Manifest V3). Firefox soporta una versión de Manifest V3 pero con diferencias en el `background` (usa `scripts` en vez de `service_worker`); no está probado en este repo.
- Cada perfil de navegador donde la instales tiene su propio plan y su propio historial de bloqueos — no se sincroniza entre dispositivos.

### Estructura

```
extension/
  manifest.json       Manifest V3: permisos, popup, background, recursos accesibles
  js/state.js          Modelo de estado compartido (plan, sesión, bloqueo, historial)
  background.js        Service worker: aplica/retira las reglas de bloqueo (declarativeNetRequest)
  popup.html/.css/.js   Setup del plan, seguimiento de sesión y vista de bloqueo
  blocked.html/.css/.js Pantalla que ve el usuario al entrar a un sitio bloqueado
  icons/                Íconos de la extensión
```

---

*Herramienta educativa, no es asesoramiento financiero.*
