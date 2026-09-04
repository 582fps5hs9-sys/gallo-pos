const express = require('express');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'gallo2026';

function defaultState() {
  return {
    waiters: { names: ['Laura', 'Diego', 'Ana', 'Pepe'], claimedBy: {} },
    tabs: [],
  };
}

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.waiters && Array.isArray(parsed.tabs)) return parsed;
    } catch (e) {
      console.error('No se pudo leer data.json, iniciando limpio:', e.message);
    }
  }
  return defaultState();
}

function saveState(state) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('No se pudo guardar data.json:', e.message);
  }
}

let state = loadState();

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast() {
  const payload = JSON.stringify({ type: 'state', state });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function persistAndBroadcast() {
  saveState(state);
  broadcast();
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'state', state }));
  ws.on('error', () => {});
});

// ---------- API ----------

app.get('/api/state', (req, res) => {
  res.json(state);
});

app.post('/api/waiters/claim', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name requerido' });
  if (state.waiters.claimedBy[name]) {
    return res.status(409).json({ error: 'ocupado' });
  }
  state.waiters.claimedBy[name] = true;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/waiters/release', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name requerido' });
  delete state.waiters.claimedBy[name];
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/waiters/release-all', (req, res) => {
  state.waiters.claimedBy = {};
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/waiters/add', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'name requerido' });
  const clean = String(name).trim();
  if (state.waiters.names.includes(clean)) return res.status(409).json({ error: 'ya existe' });
  state.waiters.names.push(clean);
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/waiters/remove', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name requerido' });
  state.waiters.names = state.waiters.names.filter((n) => n !== name);
  delete state.waiters.claimedBy[name];
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/tabs', (req, res) => {
  const { waiter, table } = req.body || {};
  if (!waiter) return res.status(400).json({ error: 'waiter requerido' });
  const id = 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const tab = {
    id,
    waiter,
    table: table || '',
    status: 'open',
    items: [],
    createdAt: new Date().toISOString(),
  };
  state.tabs.push(tab);
  persistAndBroadcast();
  res.json({ ok: true, tab, state });
});

app.patch('/api/tabs/:id/items', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  tab.items = Array.isArray(req.body.items) ? req.body.items : [];
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.patch('/api/tabs/:id/status', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  tab.status = req.body.status;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'contraseña incorrecta' });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Gallo POS server escuchando en puerto ' + PORT);
});
