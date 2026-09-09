const STORAGE_KEY = 'artalia-bloqueo-operativo-state';

const INSTRUMENTS = [
  { id: 'EURUSD', label: 'EUR/USD', pipSize: 0.0001, pipValue: 10 },
  { id: 'GBPUSD', label: 'GBP/USD', pipSize: 0.0001, pipValue: 10 },
  { id: 'AUDUSD', label: 'AUD/USD', pipSize: 0.0001, pipValue: 10 },
  { id: 'USDJPY', label: 'USD/JPY', pipSize: 0.01, pipValue: 9.3 },
  { id: 'USDCAD', label: 'USD/CAD', pipSize: 0.0001, pipValue: 7.4 },
  { id: 'XAUUSD', label: 'XAU/USD (Oro)', pipSize: 0.01, pipValue: 1 },
  { id: 'XAGUSD', label: 'XAG/USD (Plata)', pipSize: 0.001, pipValue: 5 },
  { id: 'BTCUSD', label: 'BTC/USD', pipSize: 1, pipValue: 1 },
  { id: 'INDICES', label: 'Índices (US30/NAS100/...)', pipSize: 1, pipValue: 1 },
  { id: 'CUSTOM', label: 'Personalizado', pipSize: '', pipValue: '' },
];

const LOCK_REASONS = {
  max_trades: 'Alcanzaste el máximo de operaciones del plan',
  max_loss: 'Alcanzaste la pérdida máxima diaria del plan',
  profit_target: 'Alcanzaste el objetivo de ganancia del plan',
  manual: 'Marcaste el plan como completado',
};

function defaultState() {
  return {
    plan: {
      balance: 1000,
      riskPercent: 1,
      maxTrades: 3,
      maxDailyLoss: 30,
      profitTarget: 0,
      watchSites: [],
      overridePhrase: 'ACEPTO ROMPER MI PLAN',
    },
    committed: false,
    tradingDate: null,
    trades: [],
    locked: false,
    lockReason: null,
    lockedAt: null,
    overriddenToday: false,
    overrideLog: [],
  };
}

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function normalizeSite(raw) {
  return (raw || '').trim();
}

function parseSiteList(text) {
  return text
    .split(/[\n,]/)
    .map(normalizeSite)
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeDefaults(partial) {
  const base = defaultState();
  return { ...base, ...partial, plan: { ...base.plan, ...(partial && partial.plan) } };
}

function applyRollover(state) {
  if (!state.committed || state.tradingDate === todayStr()) return { state, changed: false };
  const next = deepClone(state);
  next.committed = false;
  next.tradingDate = null;
  next.trades = [];
  next.locked = false;
  next.lockReason = null;
  next.lockedAt = null;
  next.overriddenToday = false;
  return { state: next, changed: true };
}

function totals(state) {
  const tradesCount = state.trades.length;
  const pnlTotal = state.trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  return { tradesCount, pnlTotal, lossUsed: Math.max(0, -pnlTotal) };
}

function evaluateLock(state) {
  if (!state.committed || state.locked || state.overriddenToday) return { state, changed: false };
  const { tradesCount, pnlTotal } = totals(state);
  const { plan } = state;
  let reason = null;
  if (plan.maxTrades > 0 && tradesCount >= plan.maxTrades) reason = 'max_trades';
  else if (plan.maxDailyLoss > 0 && pnlTotal <= -plan.maxDailyLoss) reason = 'max_loss';
  else if (plan.profitTarget > 0 && pnlTotal >= plan.profitTarget) reason = 'profit_target';
  if (!reason) return { state, changed: false };
  const next = deepClone(state);
  next.locked = true;
  next.lockReason = reason;
  next.lockedAt = Date.now();
  return { state: next, changed: true };
}

function loadState() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    stored = null;
  }
  let state = mergeDefaults(stored || {});
  const rolled = applyRollover(state);
  state = rolled.state;
  if (rolled.changed) saveState(state);
  return state;
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return state;
}

// ---------- App ----------

const $ = (id) => document.getElementById(id);
let state = loadState();

function render() {
  $('view-setup').hidden = true;
  $('view-session').hidden = true;
  $('view-locked').hidden = true;

  if (state.locked) {
    renderLocked();
    $('view-locked').hidden = false;
  } else if (state.committed) {
    renderSession();
    $('view-session').hidden = false;
  } else {
    renderSetup();
    $('view-setup').hidden = false;
  }

  const dateFmt = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('dateLabel').textContent = state.committed
    ? `${dateFmt} · Plan: $${state.plan.balance} · ${state.plan.riskPercent}% por operación`
    : dateFmt;
}

function persist() {
  saveState(state);
}

// ---------- Setup view ----------

function renderSetup() {
  const p = state.plan;
  $('planBalance').value = p.balance ?? '';
  $('planRisk').value = p.riskPercent ?? '';
  $('planMaxTrades').value = p.maxTrades ?? '';
  $('planMaxLoss').value = p.maxDailyLoss ?? '';
  $('planProfitTarget').value = p.profitTarget ?? '';
  $('planSites').value = (p.watchSites || []).join(', ');
  $('planOverridePhrase').value = p.overridePhrase || '';
}

function bindSetupView() {
  $('commitBtn').addEventListener('click', () => {
    $('setupError').textContent = '';

    const balance = parseFloat($('planBalance').value);
    const riskPercent = parseFloat($('planRisk').value);
    const maxTrades = parseInt($('planMaxTrades').value || '0', 10);
    const maxDailyLoss = parseFloat($('planMaxLoss').value || '0');
    const profitTarget = parseFloat($('planProfitTarget').value || '0');
    const watchSites = parseSiteList($('planSites').value);
    const overridePhrase = $('planOverridePhrase').value.trim() || 'ACEPTO ROMPER MI PLAN';

    if (!(balance > 0)) return showSetupError('Ingresá un balance de cuenta válido.');
    if (!(riskPercent > 0)) return showSetupError('Ingresá un riesgo por operación válido.');
    if (!(maxTrades > 0) && !(maxDailyLoss > 0)) {
      return showSetupError('Definí al menos un límite: máximo de operaciones o pérdida máxima diaria.');
    }

    state.plan = {
      balance, riskPercent,
      maxTrades: maxTrades || 0,
      maxDailyLoss: maxDailyLoss || 0,
      profitTarget: profitTarget || 0,
      watchSites,
      overridePhrase,
    };
    state.committed = true;
    state.tradingDate = todayStr();
    state.trades = [];
    state.locked = false;
    state.lockReason = null;
    state.lockedAt = null;
    state.overriddenToday = false;

    persist();
    render();
  });
}

function showSetupError(msg) {
  $('setupError').textContent = msg;
}

// ---------- Session view: calculator ----------

function populateInstruments() {
  const select = $('calcInstrument');
  INSTRUMENTS.forEach((inst) => {
    const opt = document.createElement('option');
    opt.value = inst.id;
    opt.textContent = inst.label;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => {
    const inst = INSTRUMENTS.find((i) => i.id === select.value);
    if (!inst || inst.id === 'CUSTOM') return;
    $('pipSize').value = inst.pipSize;
    $('pipValue').value = inst.pipValue;
  });
  select.value = 'EURUSD';
  select.dispatchEvent(new Event('change'));
}

let calcMode = 'pips';

function bindCalcTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      calcMode = tab.dataset.tab;
      document.querySelectorAll('.sl-mode').forEach((section) => {
        section.classList.toggle('active', section.dataset.mode === calcMode);
      });
      $('calcResults').classList.remove('show');
    });
  });
}

function setCalcError(fieldId, message) {
  const field = $(fieldId);
  const errorEl = document.querySelector(`[data-error-for="${fieldId}"]`);
  const group = field ? field.closest('.form-group') : null;
  if (errorEl) errorEl.textContent = message || '';
  if (group) group.classList.toggle('has-error', Boolean(message));
}

function clearCalcErrors() {
  document.querySelectorAll('#calcForm .error-text').forEach((el) => (el.textContent = ''));
  document.querySelectorAll('#calcForm .form-group').forEach((el) => el.classList.remove('has-error'));
}

function bindCalcForm() {
  $('calcForm').addEventListener('submit', (e) => {
    e.preventDefault();
    clearCalcErrors();
    $('calcResults').classList.remove('show');

    const balance = state.plan.balance;
    const riskPercent = state.plan.riskPercent;
    const pipSize = parseFloat($('pipSize').value);
    const pipValue = parseFloat($('pipValue').value);
    let valid = true;

    if (!(pipSize > 0)) { setCalcError('pipSize', 'Requerido'); valid = false; }
    if (!(pipValue > 0)) { setCalcError('pipValue', 'Requerido'); valid = false; }

    let slPips = 0, entry = null, stop = null;
    if (calcMode === 'pips') {
      slPips = parseFloat($('slPips').value);
      if (!(slPips > 0)) { setCalcError('slPips', 'Ingresá la distancia del SL'); valid = false; }
    } else {
      entry = parseFloat($('entryPrice').value);
      stop = parseFloat($('stopPrice').value);
      if (!(entry > 0)) { setCalcError('entryPrice', 'Requerido'); valid = false; }
      if (!(stop > 0)) { setCalcError('stopPrice', 'Requerido'); valid = false; }
      if (valid && entry === stop) { setCalcError('stopPrice', 'Debe ser distinto al precio de entrada'); valid = false; }
      if (valid) slPips = Math.abs(entry - stop) / pipSize;
    }
    if (!valid) return;

    const riskMoneyPlanned = balance * (riskPercent / 100);
    const rawLots = riskMoneyPlanned / (slPips * pipValue);
    const lots = Math.floor(rawLots * 100) / 100;

    if (lots <= 0) {
      setCalcError(calcMode === 'pips' ? 'slPips' : 'stopPrice', 'El riesgo definido no alcanza ni para un micro-lote (0.01).');
      return;
    }

    const riskMoneyActual = lots * slPips * pipValue;
    $('resLot').textContent = lots.toFixed(2);
    $('resRiskMoney').textContent = `$${riskMoneyActual.toFixed(2)}`;
    $('resSlPips').textContent = slPips.toFixed(1);

    const rr = parseFloat($('rr').value);
    const tpRow = $('tpRow');
    if (rr > 0) {
      const tpPips = slPips * rr;
      const gain = lots * tpPips * pipValue;
      $('resGain').textContent = `$${gain.toFixed(2)}`;
      $('resRatio').textContent = `1 : ${rr.toFixed(1)}`;
      if (calcMode === 'price' && entry !== null && stop !== null) {
        const direction = stop < entry ? 1 : -1;
        const tpPrice = entry + direction * tpPips * pipSize;
        $('resTp').textContent = tpPrice.toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
        $('resTpSub').textContent = `${tpPips.toFixed(1)} pips/puntos`;
      } else {
        $('resTp').textContent = `${tpPips.toFixed(1)}`;
        $('resTpSub').textContent = 'pips/puntos de distancia';
      }
      tpRow.style.display = 'grid';
    } else {
      tpRow.style.display = 'none';
    }

    $('calcResults').classList.add('show');
  });
}

// ---------- Session view: progress + trade log ----------

function renderSession() {
  const { tradesCount, pnlTotal } = totals(state);
  const plan = state.plan;

  $('planSummaryLine').textContent = `Balance $${plan.balance} · Riesgo ${plan.riskPercent}% por operación`;

  $('sessTradesLabel').textContent = `${tradesCount} / ${plan.maxTrades || '∞'}`;
  $('sessTradesBar').style.width = plan.maxTrades > 0 ? `${Math.min(100, (tradesCount / plan.maxTrades) * 100)}%` : '0%';

  const lossUsed = Math.max(0, -pnlTotal);
  $('sessLossLabel').textContent = `$${lossUsed.toFixed(2)} / $${plan.maxDailyLoss.toFixed(2)}`;
  $('sessLossBar').style.width = plan.maxDailyLoss > 0 ? `${Math.min(100, (lossUsed / plan.maxDailyLoss) * 100)}%` : '0%';

  if (plan.profitTarget > 0) {
    $('sessProfitRow').hidden = false;
    $('sessProfitTrack').hidden = false;
    const profitUsed = Math.max(0, pnlTotal);
    $('sessProfitLabel').textContent = `$${profitUsed.toFixed(2)} / $${plan.profitTarget.toFixed(2)}`;
    $('sessProfitBar').style.width = `${Math.min(100, (profitUsed / plan.profitTarget) * 100)}%`;
  } else {
    $('sessProfitRow').hidden = true;
    $('sessProfitTrack').hidden = true;
  }

  const pnlEl = $('sessPnlTotal');
  pnlEl.textContent = `P&L del día: ${pnlTotal >= 0 ? '+' : ''}$${pnlTotal.toFixed(2)}`;
  pnlEl.style.color = pnlTotal > 0 ? '#27ae60' : pnlTotal < 0 ? '#e74c3c' : '#fff';

  const list = $('tradeList');
  list.innerHTML = '';
  state.trades.slice().reverse().forEach((t) => {
    const li = document.createElement('li');
    const time = new Date(t.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const resultLabel = { win: 'Ganadora', loss: 'Perdedora', be: 'Break-even' }[t.result] || t.result;
    const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
    li.innerHTML = `<span>${time} · ${resultLabel}</span><span class="${pnlClass}">${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}</span>`;
    list.appendChild(li);
  });

  const sitesPanel = $('watchSitesPanel');
  if (plan.watchSites && plan.watchSites.length > 0) {
    sitesPanel.hidden = false;
    $('watchSitesList').innerHTML = plan.watchSites.map((s) => `<li>${s}</li>`).join('');
  } else {
    sitesPanel.hidden = true;
  }
}

function bindTradeLog() {
  $('logTradeBtn').addEventListener('click', () => {
    $('tradeError').textContent = '';
    const result = $('tradeResult').value;
    let pnl = parseFloat($('tradePnl').value);
    if (Number.isNaN(pnl)) { $('tradeError').textContent = 'Ingresá el resultado en dinero.'; return; }

    if (result === 'win') pnl = Math.abs(pnl);
    else if (result === 'loss') pnl = -Math.abs(pnl);
    else pnl = 0;

    state.trades.push({ id: Date.now(), time: Date.now(), result, pnl });
    const evaluated = evaluateLock(state);
    state = evaluated.state;

    persist();
    $('tradePnl').value = '';
    render();
  });

  $('finishBtn').addEventListener('click', () => {
    const ok = confirm('¿Marcar el plan de hoy como completado? La app se va a bloquear hasta tu próxima sesión.');
    if (!ok) return;
    state.locked = true;
    state.lockReason = 'manual';
    state.lockedAt = Date.now();
    persist();
    render();
  });
}

// ---------- Locked view ----------

function renderLocked() {
  const { tradesCount, pnlTotal } = totals(state);
  $('lockTitle').textContent = LOCK_REASONS[state.lockReason] || 'Plan completado';
  $('lockSummary').innerHTML = `
    <span>Operaciones: ${tradesCount} / ${state.plan.maxTrades || '∞'}</span>
    <span>P&amp;L del día: ${pnlTotal >= 0 ? '+' : ''}$${pnlTotal.toFixed(2)}</span>
    <span>Bloqueado desde: ${new Date(state.lockedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
  `;

  const sites = state.plan.watchSites || [];
  const reminderEl = $('lockSitesReminder');
  if (sites.length > 0) {
    reminderEl.hidden = false;
    reminderEl.innerHTML = `<strong>Recordatorio — evitá entrar a:</strong><ul>${sites.map((s) => `<li>${s}</li>`).join('')}</ul>`;
  } else {
    reminderEl.hidden = true;
  }

  const overrides = state.overrideLog.length;
  $('overrideStats').textContent = overrides > 0
    ? `Ya rompiste el bloqueo antes de tiempo ${overrides} ${overrides === 1 ? 'vez' : 'veces'}.`
    : 'Nunca rompiste tu plan antes de tiempo. Así se construye disciplina.';
}

function bindLockedView() {
  $('overrideBtn').addEventListener('click', () => {
    $('overrideError').textContent = '';
    const typed = $('overrideInput').value.trim().toLowerCase();
    const expected = (state.plan.overridePhrase || '').trim().toLowerCase();
    if (!typed || typed !== expected) {
      $('overrideError').textContent = 'La frase no coincide.';
      return;
    }
    state.locked = false;
    state.overriddenToday = true;
    state.overrideLog.push({ date: todayStr(), time: Date.now() });
    persist();
    $('overrideInput').value = '';
    render();
  });
}

// ---------- Install prompt ----------

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $('installBtn').hidden = false;
});
window.addEventListener('appinstalled', () => {
  $('installBtn').hidden = true;
  deferredInstallPrompt = null;
});

function bindInstallButton() {
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('installBtn').hidden = true;
  });
}

// ---------- Init ----------

function init() {
  populateInstruments();
  bindCalcTabs();
  bindCalcForm();
  bindSetupView();
  bindTradeLog();
  bindLockedView();
  bindInstallButton();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
