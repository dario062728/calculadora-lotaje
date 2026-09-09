// Shared state model for the extension. Loaded via <script> in popup/blocked
// pages and via importScripts() in the background service worker, so it must
// stay dependency-free and attach everything to a single global: TOL.
(function (global) {
  const STORAGE_KEY = 'state';

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
        blockedSites: [],
        overridePhrase: 'ACEPTO ROMPER MI PLAN',
      },
      committed: false,
      tradingDate: null,
      locked: false,
      lockReason: null,
      lockedAt: null,
      overriddenToday: false,
      overrideLog: [],
      history: [], // { id, time, date, result, pnl } — every trade ever logged, never cleared
    };
  }

  function todayStr(d = new Date()) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function startOfWeekStr() {
    const d = new Date();
    const day = d.getDay(); // 0=Sun .. 6=Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);
    return todayStr(monday);
  }

  function normalizeDomain(raw) {
    if (!raw) return '';
    let s = raw.trim().toLowerCase();
    s = s.replace(/^[a-z]+:\/\//, '');
    s = s.replace(/^www\./, '');
    s = s.split('/')[0];
    s = s.split('?')[0];
    return s;
  }

  function parseSiteList(text) {
    return text
      .split(/[\n,]/)
      .map(normalizeDomain)
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function mergeDefaults(state) {
    const base = defaultState();
    return {
      ...base,
      ...state,
      plan: { ...base.plan, ...(state && state.plan) },
    };
  }

  // Resets the session if the stored tradingDate is not today. Plan values
  // and override history survive; the trader must re-commit each day.
  function applyRollover(state) {
    if (!state.committed || state.tradingDate === todayStr()) {
      return { state, changed: false };
    }
    const next = deepClone(state);
    next.committed = false;
    next.tradingDate = null;
    next.locked = false;
    next.lockReason = null;
    next.lockedAt = null;
    next.overriddenToday = false;
    return { state: next, changed: true };
  }

  function todaysTrades(state) {
    if (!state.tradingDate) return [];
    return state.history.filter((t) => t.date === state.tradingDate);
  }

  function aggregate(trades) {
    const tradesCount = trades.length;
    const pnlTotal = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
    const wins = trades.filter((t) => t.result === 'win').length;
    const losses = trades.filter((t) => t.result === 'loss').length;
    const breakEven = trades.filter((t) => t.result === 'be').length;
    const winRate = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;
    return { tradesCount, pnlTotal, wins, losses, breakEven, winRate };
  }

  // Today's totals, used for evaluating the plan's lock conditions.
  function totals(state) {
    const trades = todaysTrades(state);
    const { tradesCount, pnlTotal } = aggregate(trades);
    return { tradesCount, pnlTotal, lossUsed: Math.max(0, -pnlTotal) };
  }

  function stats(state) {
    const weekStart = startOfWeekStr();
    const week = aggregate(state.history.filter((t) => t.date >= weekStart));
    const allTime = aggregate(state.history);
    return { week, allTime };
  }

  // Checks plan limits against current trades and locks if any is breached.
  // A limit of 0/empty means "disabled" for that rule.
  function evaluateLock(state) {
    if (!state.committed || state.locked || state.overriddenToday) {
      return { state, changed: false };
    }
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

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    let state = mergeDefaults(stored[STORAGE_KEY] || {});
    const rolled = applyRollover(state);
    state = rolled.state;
    if (rolled.changed) await saveState(state);
    return state;
  }

  async function saveState(state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    return state;
  }

  global.TOL = {
    STORAGE_KEY,
    LOCK_REASONS,
    defaultState,
    todayStr,
    startOfWeekStr,
    normalizeDomain,
    parseSiteList,
    deepClone,
    todaysTrades,
    totals,
    stats,
    evaluateLock,
    loadState,
    saveState,
  };
})(typeof self !== 'undefined' ? self : this);
