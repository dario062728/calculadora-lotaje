const $ = (id) => document.getElementById(id);

function siteFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('site') || '';
}

async function init() {
  const site = siteFromQuery();
  $('siteLabel').textContent = site ? `${site} está bloqueado` : 'Sitio bloqueado';

  const state = await TOL.loadState();

  if (!state.locked) {
    $('notCommittedNote').hidden = false;
    document.querySelector('.override').hidden = true;
    $('resetNote').textContent = '';
    $('summary').hidden = true;
    return;
  }

  const { tradesCount, pnlTotal } = TOL.totals(state);
  $('lockReasonText').textContent = TOL.LOCK_REASONS[state.lockReason] || 'Tu plan de hoy terminó acá.';
  $('summary').innerHTML = `
    <span>Operaciones: ${tradesCount} / ${state.plan.maxTrades || '∞'}</span>
    <span>P&amp;L del día: ${pnlTotal >= 0 ? '+' : ''}$${pnlTotal.toFixed(2)}</span>
    <span>Bloqueado desde: ${new Date(state.lockedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
  `;
  $('resetNote').textContent = 'Se reinicia automáticamente en tu próxima sesión de trading.';

  const overrides = state.overrideLog.length;
  $('overrideStats').textContent = overrides > 0
    ? `Ya rompiste el bloqueo antes de tiempo ${overrides} ${overrides === 1 ? 'vez' : 'veces'}.`
    : 'Nunca rompiste tu plan antes de tiempo. Así se construye disciplina.';

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
    await TOL.saveState(state);

    document.querySelector('.override').hidden = true;
    $('unlockedText').textContent = `Desbloqueado por hoy. Vas ${state.overrideLog.length} ${state.overrideLog.length === 1 ? 'vez' : 'veces'} rompiendo el plan antes de tiempo.`;
    $('unlockedPanel').hidden = false;
    $('overrideStats').textContent = '';

    if (site) {
      $('goSiteBtn').addEventListener('click', () => {
        window.location.href = `https://${site}`;
      });
    } else {
      $('goSiteBtn').hidden = true;
    }
  });
}

init();
