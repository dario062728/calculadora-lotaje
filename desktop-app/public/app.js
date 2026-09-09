const $ = (id) => document.getElementById(id);

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function money(n) {
  const v = Number(n) || 0;
  return `${v >= 0 ? '' : '-'}$${Math.abs(v).toFixed(2)}`;
}

async function loadAndRender() {
  const [stateRes, statusRes] = await Promise.all([
    api('GET', '/api/state'),
    api('GET', '/api/status'),
  ]);
  render(stateRes.data.state, stateRes.data.stats, statusRes.data);
}

function render(state, stats, status) {
  $('view-setup').hidden = true;
  $('view-session').hidden = true;
  $('view-locked').hidden = true;

  if (state.locked) {
    renderLocked(state);
    $('view-locked').hidden = false;
  } else if (state.committed) {
    renderSession(state);
    $('view-session').hidden = false;
  } else {
    renderSetup(state);
    $('view-setup').hidden = false;
  }

  renderStats(stats);
  renderHostsWarning(state, status);

  const dateFmt = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('dateLabel').textContent = state.committed
    ? `${dateFmt} · Plan: $${state.plan.balance} · ${state.plan.riskPercent}% por operación`
    : dateFmt;
}

function renderStats(stats) {
  if (!stats) return;
  $('statWeekPnl').textContent = money(stats.week.pnlTotal);
  $('statWeekPnl').style.color = stats.week.pnlTotal > 0 ? '#27ae60' : stats.week.pnlTotal < 0 ? '#e74c3c' : '#fff';
  $('statWeekTrades').textContent = `${stats.week.tradesCount} operaciones`;

  $('statAllPnl').textContent = money(stats.allTime.pnlTotal);
  $('statAllPnl').style.color = stats.allTime.pnlTotal > 0 ? '#27ae60' : stats.allTime.pnlTotal < 0 ? '#e74c3c' : '#fff';
  $('statAllTrades').textContent = `${stats.allTime.tradesCount} operaciones · ${stats.allTime.winRate.toFixed(0)}% de aciertos`;
}

function renderHostsWarning(state, status) {
  const banner = $('hostsWarning');
  if (state.locked && status && status.ok && !status.hostsBlockActive) {
    banner.hidden = false;
    banner.textContent = '⚠️ El plan está bloqueado, pero no se pudo aplicar el bloqueo a nivel de sistema. Cerrá esta app y volvé a abrirla con el launcher como Administrador (Windows) o con sudo (Mac) para que el bloqueo sea real.';
  } else if (status && status.ok === false) {
    banner.hidden = false;
    banner.textContent = `⚠️ No se pudo acceder al archivo hosts: ${status.error}`;
  } else {
    banner.hidden = true;
  }
}

// ---------- Setup view ----------

function renderSetup(state) {
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
  $('commitBtn').addEventListener('click', async () => {
    $('setupError').textContent = '';
    const payload = {
      balance: $('planBalance').value,
      riskPercent: $('planRisk').value,
      maxTrades: $('planMaxTrades').value,
      maxDailyLoss: $('planMaxLoss').value,
      profitTarget: $('planProfitTarget').value,
      blockedSites: $('planSites').value,
      overridePhrase: $('planOverridePhrase').value,
    };
    const { ok, data } = await api('POST', '/api/commit', payload);
    if (!ok) { $('setupError').textContent = data.error; return; }
    loadAndRender();
  });
}

// ---------- Session view ----------

function renderSession(state) {
  const plan = state.plan;
  const trades = state.history.filter((t) => t.date === state.tradingDate);
  const tradesCount = trades.length;
  const pnlTotal = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);

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
  pnlEl.textContent = `P&L del día: ${money(pnlTotal)}`;
  pnlEl.style.color = pnlTotal > 0 ? '#27ae60' : pnlTotal < 0 ? '#e74c3c' : '#fff';

  const list = $('tradeList');
  list.innerHTML = '';
  trades.slice().reverse().forEach((t) => {
    const li = document.createElement('li');
    const time = new Date(t.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const resultLabel = { win: 'Ganadora', loss: 'Perdedora', be: 'Break-even' }[t.result] || t.result;
    const pnlClass = t.pnl > 0 ? 'pnl-pos' : t.pnl < 0 ? 'pnl-neg' : '';
    li.innerHTML = `<span>${time} · ${resultLabel}</span><span class="${pnlClass}">${money(t.pnl)}</span>`;
    list.appendChild(li);
  });

  const sitesPanel = $('watchSitesPanel');
  if (plan.blockedSites && plan.blockedSites.length > 0) {
    sitesPanel.hidden = false;
    $('watchSitesList').innerHTML = plan.blockedSites.map((s) => `<li>${s}</li>`).join('');
  } else {
    sitesPanel.hidden = true;
  }
}

function bindTradeLog() {
  $('logTradeBtn').addEventListener('click', async () => {
    $('tradeError').textContent = '';
    const result = $('tradeResult').value;
    const pnl = $('tradePnl').value;
    const { ok, data } = await api('POST', '/api/trade', { result, pnl });
    if (!ok) { $('tradeError').textContent = data.error; return; }
    $('tradePnl').value = '';
    loadAndRender();
  });

  $('finishBtn').addEventListener('click', async () => {
    const confirmed = confirm('¿Marcar el plan de hoy como completado? Se van a bloquear los sitios/apps configurados a nivel de todo el sistema.');
    if (!confirmed) return;
    const { ok, data } = await api('POST', '/api/finish');
    if (!ok) { alert(data.error); return; }
    loadAndRender();
  });
}

// ---------- Locked view ----------

function renderLocked(state) {
  const trades = state.history.filter((t) => t.date === state.tradingDate);
  const tradesCount = trades.length;
  const pnlTotal = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);

  const reasons = {
    max_trades: 'Alcanzaste el máximo de operaciones del plan',
    max_loss: 'Alcanzaste la pérdida máxima diaria del plan',
    profit_target: 'Alcanzaste el objetivo de ganancia del plan',
    manual: 'Marcaste el plan como completado',
  };
  $('lockTitle').textContent = reasons[state.lockReason] || 'Plan completado';
  $('lockSummary').innerHTML = `
    <span>Operaciones: ${tradesCount} / ${state.plan.maxTrades || '∞'}</span>
    <span>P&amp;L del día: ${money(pnlTotal)}</span>
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
    const phrase = $('overrideInput').value;
    const { ok, data } = await api('POST', '/api/override', { phrase });
    if (!ok) { $('overrideError').textContent = data.error; return; }
    $('overrideInput').value = '';
    loadAndRender();
  });
}

function init() {
  bindSetupView();
  bindTradeLog();
  bindLockedView();
  loadAndRender();
  setInterval(loadAndRender, 15000);
}

init();
