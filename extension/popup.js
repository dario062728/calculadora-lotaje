const INSTRUMENTS = [
  { id: 'EURUSD', label: 'EUR/USD', pipSize: 0.0001, pipValue: 10 },
  { id: 'GBPUSD', label: 'GBP/USD', pipSize: 0.0001, pipValue: 10 },
  { id: 'USDJPY', label: 'USD/JPY', pipSize: 0.01, pipValue: 9.3 },
  { id: 'XAUUSD', label: 'XAU/USD (Oro)', pipSize: 0.01, pipValue: 1 },
  { id: 'XAGUSD', label: 'XAG/USD (Plata)', pipSize: 0.001, pipValue: 5 },
  { id: 'BTCUSD', label: 'BTC/USD', pipSize: 1, pipValue: 1 },
  { id: 'INDICES', label: 'Índices (US30/NAS100/...)', pipSize: 1, pipValue: 1 },
  { id: 'CUSTOM', label: 'Personalizado', pipSize: '', pipValue: '' },
];

const $ = (id) => document.getElementById(id);
let state = null;

async function init() {
  state = await TOL.loadState();
  populateInstruments();
  bindSetupView();
  bindSessionView();
  bindLockedView();
  render();
}

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

async function persist() {
  await TOL.saveState(state);
}

// ---------- Setup view ----------

function renderSetup() {
  const p = state.plan;
  $('planBalance').value = p.balance ?? '';
  $('planRisk').value = p.riskPercent ?? '';
  $('planMaxTrades').value = p.maxTrades ?? '';
  $('planMaxLoss').value = p.maxDailyLoss ?? '';
  $('planProfitTarget').value = p.profitTarget ?? '';
  $('planSites').value = (p.blockedSites || []).join(', ');
  $('planOverridePhrase').value = p.overridePhrase || '';
}

function bindSetupView() {
  const draftFields = ['planBalance', 'planRisk', 'planMaxTrades', 'planMaxLoss', 'planProfitTarget', 'planOverridePhrase'];
  draftFields.forEach((id) => {
    $(id).addEventListener('blur', () => saveDraft());
  });
  $('planSites').addEventListener('blur', () => saveDraft());

  $('commitBtn').addEventListener('click', async () => {
    $('setupError').textContent = '';
    $('sitesError').textContent = '';

    const balance = parseFloat($('planBalance').value);
    const riskPercent = parseFloat($('planRisk').value);
    const maxTrades = parseInt($('planMaxTrades').value || '0', 10);
    const maxDailyLoss = parseFloat($('planMaxLoss').value || '0');
    const profitTarget = parseFloat($('planProfitTarget').value || '0');
    const sites = TOL.parseSiteList($('planSites').value);
    const overridePhrase = $('planOverridePhrase').value.trim() || 'ACEPTO ROMPER MI PLAN';

    if (!(balance > 0)) return showSetupError('Ingresá un balance de cuenta válido.');
    if (!(riskPercent > 0)) return showSetupError('Ingresá un riesgo por operación válido.');
    if (!(maxTrades > 0) && !(maxDailyLoss > 0)) {
      return showSetupError('Definí al menos un límite: máximo de operaciones o pérdida máxima diaria.');
    }
    if (sites.length === 0) {
      $('sitesError').textContent = 'Agregá al menos un sitio para bloquear (ej: tuBroker.com).';
      return;
    }

    state.plan = {
      balance, riskPercent,
      maxTrades: maxTrades || 0,
      maxDailyLoss: maxDailyLoss || 0,
      profitTarget: profitTarget || 0,
      blockedSites: sites,
      overridePhrase,
    };
    state.committed = true;
    state.tradingDate = TOL.todayStr();
    state.trades = [];
    state.locked = false;
    state.lockReason = null;
    state.lockedAt = null;
    state.overriddenToday = false;

    await persist();
    render();
  });
}

function showSetupError(msg) {
  $('setupError').textContent = msg;
}

function saveDraft() {
  state.plan.balance = parseFloat($('planBalance').value) || state.plan.balance;
  state.plan.riskPercent = parseFloat($('planRisk').value) || state.plan.riskPercent;
  state.plan.maxTrades = parseInt($('planMaxTrades').value || '0', 10);
  state.plan.maxDailyLoss = parseFloat($('planMaxLoss').value || '0');
  state.plan.profitTarget = parseFloat($('planProfitTarget').value || '0');
  state.plan.blockedSites = TOL.parseSiteList($('planSites').value);
  state.plan.overridePhrase = $('planOverridePhrase').value.trim() || state.plan.overridePhrase;
  persist();
}

// ---------- Session view ----------

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
    $('calcPipSize').value = inst.pipSize;
    $('calcPipValue').value = inst.pipValue;
    updateCalcResult();
  });
  select.value = 'EURUSD';
  select.dispatchEvent(new Event('change'));
}

function updateCalcResult() {
  const balance = state.plan.balance;
  const riskPercent = state.plan.riskPercent;
  const pipSize = parseFloat($('calcPipSize').value);
  const pipValue = parseFloat($('calcPipValue').value);
  const slPips = parseFloat($('calcSlPips').value);
  const out = $('calcResult');

  if (!(pipValue > 0) || !(slPips > 0)) {
    out.innerHTML = 'Lote sugerido: <strong>-</strong>';
    return;
  }
  const riskMoney = balance * (riskPercent / 100);
  const lots = Math.floor((riskMoney / (slPips * pipValue)) * 100) / 100;
  out.innerHTML = lots > 0
    ? `Lote sugerido: <strong>${lots.toFixed(2)}</strong> (riesgo $${riskMoney.toFixed(2)})`
    : 'Lote sugerido: <strong>0.00</strong> (SL muy amplio para el riesgo del plan)';
}

function renderSession() {
  const { tradesCount, pnlTotal } = TOL.totals(state);
  const plan = state.plan;

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

  updateCalcResult();
}

function bindSessionView() {
  ['calcPipSize', 'calcPipValue', 'calcSlPips'].forEach((id) => {
    $(id).addEventListener('input', updateCalcResult);
  });

  $('logTradeBtn').addEventListener('click', async () => {
    $('tradeError').textContent = '';
    const result = $('tradeResult').value;
    let pnl = parseFloat($('tradePnl').value);
    if (Number.isNaN(pnl)) { $('tradeError').textContent = 'Ingresá el resultado en dinero.'; return; }

    if (result === 'win') pnl = Math.abs(pnl);
    else if (result === 'loss') pnl = -Math.abs(pnl);
    else pnl = 0;

    state.trades.push({ id: Date.now(), time: Date.now(), result, pnl });
    const evaluated = TOL.evaluateLock(state);
    state = evaluated.state;

    await persist();
    $('tradePnl').value = '';
    render();
  });

  $('finishBtn').addEventListener('click', async () => {
    const ok = confirm('¿Marcar el plan de hoy como completado? Se bloqueará el acceso a los sitios configurados.');
    if (!ok) return;
    state.locked = true;
    state.lockReason = 'manual';
    state.lockedAt = Date.now();
    await persist();
    render();
  });
}

// ---------- Locked view ----------

function renderLocked() {
  const { tradesCount, pnlTotal } = TOL.totals(state);
  $('lockTitle').textContent = TOL.LOCK_REASONS[state.lockReason] || 'Plan completado';
  $('lockReasonText').textContent = 'Tu plan de hoy terminó acá. Los sitios configurados están bloqueados hasta tu próxima sesión.';
  $('lockSummary').innerHTML = `
    <span>Operaciones: ${tradesCount} / ${state.plan.maxTrades || '∞'}</span>
    <span>P&amp;L del día: ${pnlTotal >= 0 ? '+' : ''}$${pnlTotal.toFixed(2)}</span>
    <span>Bloqueado desde: ${new Date(state.lockedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
  `;

  const overrides = state.overrideLog.length;
  $('overrideStats').textContent = overrides > 0
    ? `Ya rompiste el bloqueo antes de tiempo ${overrides} ${overrides === 1 ? 'vez' : 'veces'}.`
    : 'Nunca rompiste tu plan antes de tiempo. Así se construye disciplina.';
}

function bindLockedView() {
  $('overrideBtn').addEventListener('click', async () => {
    $('overrideError').textContent = '';
    const typed = $('overrideInput').value.trim().toLowerCase();
    const expected = (state.plan.overridePhrase || '').trim().toLowerCase();
    if (!typed || typed !== expected) {
      $('overrideError').textContent = 'La frase no coincide.';
      return;
    }
    state.locked = false;
    state.overriddenToday = true;
    state.overrideLog.push({ date: TOL.todayStr(), time: Date.now() });
    await persist();
    $('overrideInput').value = '';
    render();
  });
}

init();
