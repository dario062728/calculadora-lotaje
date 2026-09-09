const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const store = require('./state-store');
const hostsBlocker = require('./hosts-blocker');

const PORT = Number(process.env.PORT) || 5757;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function syncHostsWithState(state) {
  try {
    if (state.locked && state.plan.blockedSites.length > 0) {
      hostsBlocker.applyBlock(state.plan.blockedSites);
    } else {
      hostsBlocker.removeBlock();
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const routes = {
  'GET /api/state': (req, res) => {
    const state = store.load();
    sendJson(res, 200, { state, stats: store.stats(state), hostsPath: hostsBlocker.getHostsPath() });
  },

  'GET /api/status': (req, res) => {
    try {
      const active = hostsBlocker.isManagedBlockActive();
      sendJson(res, 200, { ok: true, hostsBlockActive: active, hostsPath: hostsBlocker.getHostsPath() });
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
  },

  'POST /api/commit': async (req, res) => {
    const body = await readJsonBody(req);
    const balance = Number(body.balance);
    const riskPercent = Number(body.riskPercent);
    const maxTrades = parseInt(body.maxTrades || '0', 10);
    const maxDailyLoss = Number(body.maxDailyLoss || 0);
    const profitTarget = Number(body.profitTarget || 0);
    const blockedSites = store.parseSiteList(body.blockedSites);
    const overridePhrase = String(body.overridePhrase || '').trim() || 'ACEPTO ROMPER MI PLAN';

    if (!(balance > 0)) return sendJson(res, 400, { ok: false, error: 'Ingresá un balance de cuenta válido.' });
    if (!(riskPercent > 0)) return sendJson(res, 400, { ok: false, error: 'Ingresá un riesgo por operación válido.' });
    if (!(maxTrades > 0) && !(maxDailyLoss > 0)) {
      return sendJson(res, 400, { ok: false, error: 'Definí al menos un límite: máximo de operaciones o pérdida máxima diaria.' });
    }
    if (blockedSites.length === 0) {
      return sendJson(res, 400, { ok: false, error: 'Agregá al menos un sitio para bloquear (ej: tradingview.com).' });
    }

    let state = store.load();
    state.plan = { balance, riskPercent, maxTrades: maxTrades || 0, maxDailyLoss: maxDailyLoss || 0, profitTarget: profitTarget || 0, blockedSites, overridePhrase };
    state.committed = true;
    state.tradingDate = store.todayStr();
    state.locked = false;
    state.lockReason = null;
    state.lockedAt = null;
    state.overriddenToday = false;
    store.save(state);

    const hostsResult = syncHostsWithState(state);
    sendJson(res, 200, { ok: true, state, stats: store.stats(state), hostsResult });
  },

  'POST /api/trade': async (req, res) => {
    const body = await readJsonBody(req);
    const result = body.result;
    let pnl = Number(body.pnl);
    if (Number.isNaN(pnl)) return sendJson(res, 400, { ok: false, error: 'Ingresá el resultado en dinero.' });
    if (result === 'win') pnl = Math.abs(pnl);
    else if (result === 'loss') pnl = -Math.abs(pnl);
    else pnl = 0;

    let state = store.load();
    if (!state.committed) return sendJson(res, 400, { ok: false, error: 'No hay un plan confirmado.' });
    state.history.push({ id: Date.now(), time: Date.now(), date: state.tradingDate, result, pnl });
    const evaluated = store.evaluateLock(state);
    state = evaluated.state;
    store.save(state);

    const hostsResult = syncHostsWithState(state);
    sendJson(res, 200, { ok: true, state, stats: store.stats(state), hostsResult });
  },

  'POST /api/finish': async (req, res) => {
    let state = store.load();
    if (!state.committed || state.locked) return sendJson(res, 400, { ok: false, error: 'No aplica en este estado.' });
    state.locked = true;
    state.lockReason = 'manual';
    state.lockedAt = Date.now();
    store.save(state);
    const hostsResult = syncHostsWithState(state);
    sendJson(res, 200, { ok: true, state, stats: store.stats(state), hostsResult });
  },

  'POST /api/override': async (req, res) => {
    const body = await readJsonBody(req);
    let state = store.load();
    const typed = String(body.phrase || '').trim().toLowerCase();
    const expected = (state.plan.overridePhrase || '').trim().toLowerCase();
    if (!state.locked) return sendJson(res, 400, { ok: false, error: 'No está bloqueado.' });
    if (!typed || typed !== expected) return sendJson(res, 400, { ok: false, error: 'La frase no coincide.' });

    state.locked = false;
    state.overriddenToday = true;
    state.overrideLog.push({ date: store.todayStr(), time: Date.now() });
    store.save(state);
    const hostsResult = syncHostsWithState(state);
    sendJson(res, 200, { ok: true, state, stats: store.stats(state), hostsResult });
  },
};

const server = http.createServer(async (req, res) => {
  const key = `${req.method} ${req.url.split('?')[0]}`;
  const handler = routes[key];
  if (handler) {
    try {
      await handler(req, res);
    } catch (err) {
      sendJson(res, 500, { ok: false, error: err.message });
    }
    return;
  }
  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Bloqueo Operativo escuchando en ${url}`);
  console.log(`Archivo hosts: ${hostsBlocker.getHostsPath()}`);

  const initialState = store.load();
  const result = syncHostsWithState(initialState);
  if (!result.ok) {
    console.warn('AVISO: no se pudo sincronizar el archivo hosts al iniciar:', result.error);
    console.warn('Si tu plan está bloqueado, puede que necesites ejecutar el launcher como administrador.');
  }

  const openCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
  exec(openCmd, () => {});
});
