# Bloqueo Operativo — Artalia Trading

Frená la sobreoperativa: cargás tu plan de trading del día con anticipación y, una vez que lo cumplís, se bloquea el acceso a los sitios que elijas hasta tu próxima sesión.

## Usá `extension/`

Es la forma recomendada: no necesita instalar Node, no pide contraseña de administrador, no usa la Terminal. Solo una extensión de Chrome/Edge/Brave.

### Instalación (2 minutos)

1. Abrí `chrome://extensions` (pegalo en la barra de direcciones).
2. Arriba a la derecha, activá **"Modo de desarrollador"**.
3. Hacé clic en **"Cargar descomprimida"**.
4. Seleccioná la carpeta **`extension`** (la de adentro de este repositorio, no el zip completo).
5. Te va a aparecer un ícono 🔒 en la barra del navegador (si no lo ves, tocá el ícono de rompecabezas 🧩 y fijalo).

### Cómo usarla

1. **Estadísticas**: arriba de todo, siempre visibles — resultado de la semana y resultado + operaciones totales (con % de aciertos). Se acumulan solas, para siempre.
2. **Plan del día**: cargás balance, riesgo por operación, máximo de operaciones, pérdida máxima diaria, objetivo de ganancia (opcional) y los sitios a bloquear (ej. `tradingview.com`). Confirmás.
3. **Sesión**: calculadora de lotaje con el riesgo ya fijado por el plan, y vas registrando cada operación ejecutada.
4. **Bloqueo automático**: al cumplir cualquier límite del plan (o marcar "plan completado"), la extensión bloquea de verdad el acceso a esos sitios — cualquier pestaña que intente entrar es redirigida a una pantalla de bloqueo con el resumen del día.
5. **Reinicio**: se desbloquea solo al otro día de trading. El plan queda cargado, pero hay que reconfirmarlo.
6. **Desbloqueo de emergencia**: requiere escribir una frase exacta que vos definiste. Queda registrado para siempre en tu historial de disciplina.

### Qué bloquea y qué no

Bloquea la navegación **dentro del navegador** hacia los dominios que configuraste (cualquier pestaña, en cualquier momento). **No bloquea aplicaciones de escritorio ni del celular** (por ejemplo, la app de TradingView instalada en tu computadora o teléfono) — eso está fuera del alcance de una extensión de navegador, ningún bloqueador de este tipo puede hacerlo de forma confiable.

Para el celular, usá la función que ya trae el teléfono — 2 minutos, una sola vez:
- **iPhone**: Ajustes → Tiempo de Uso → Límites de Apps → elegís la app → ponés un límite.
- **Android**: Ajustes → Bienestar Digital → Temporizadores de apps → elegís la app.

## Otras carpetas de este repositorio

`index.html` / `app.js` (raíz) y `desktop-app/` fueron intentos anteriores (una app web instalable y una app de escritorio con Node). Quedan en el repositorio pero **no son el camino recomendado** — requerían más pasos manuales para un resultado menos confiable que la extensión. Si no las necesitás, podés ignorarlas.

---

*Herramienta educativa, no es asesoramiento financiero.*
