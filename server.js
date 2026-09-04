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

function defaultPrices() {
  return {
    "Corona Extra": { simple: 60 },
    "Corona Light": { simple: 60 },
    "Victoria": { simple: 60 },
    "Modelo Especial/Negra": { simple: 60 },
    "Bud Light": { simple: 60 },
    "Pacífico": { simple: 60 },
    "Michelob Ultra": { simple: 60 },
    "Budweiser": { simple: 60 },
    "Don Julio": { simple: 130 },
    "Perla Negra": { simple: 140 },
    "Bufanda": { simple: 140 },
    "Gallito": { simple: 140 },
    "Piña Colada": { copeo: 120, litro: 240 },
    "Buchanans 12": { copeo: 110, litro: 220, botella: 1800 },
    "Buchanans Master": { copeo: 190, litro: 320, botella: 2600 },
    "Buchanans 18": { copeo: 300, litro: 600, botella: 3400 },
    "Buchanans Piña": { copeo: 130, litro: 240 },
    "Etiqueta Negra": { copeo: 110, litro: 220, botella: 1800 },
    "Double Black": { copeo: 190, litro: 320 },
    "Jack Daniels": { copeo: 110, litro: 220 },
    "Chivas Regal": { copeo: 190, litro: 320 },
    "Macallan 12": { copeo: 190, litro: 320 },
    "Bacardi": { copeo: 90, litro: 180, botella: 950 },
    "Bacardi Mango": { copeo: 90, litro: 180, botella: 1050 },
    "Don Julio 70": { copeo: 130, litro: 220, botella: 1800 },
    "Maestro Dobel": { copeo: 130, litro: 220, botella: 1800 },
    "1800 Cristalino": { copeo: 130, litro: 240, botella: 1800 },
    "Jose Cuervo Esp": { copeo: 100, litro: 190 },
    "400 Conejos": { copeo: 110, litro: 200 },
    "Smirnoff Tamarindo": { copeo: 90, litro: 190, botella: 950 },
    "Capitán Morgan": { copeo: 100, litro: 190 },
    "Absolut Vodka": { copeo: 100, litro: 190 },
    "Margarita": { copeo: 110, litro: 220 },
    "Mezcalita": { copeo: 110, litro: 220 },
    "Paloma": { copeo: 110, litro: 220 },
    "Cuba Libre": { copeo: 110, litro: 220 },
    "Vampiro": { copeo: 110, litro: 220 },
    "Mojito": { copeo: 110, litro: 220 },
    "Perro Salado": { copeo: 110, litro: 220 },
    "Gin Tonic": { copeo: 110, litro: 220 },
    "Clericot": { copeo: 120, litro: 240 },
    "Jagger 43": { copeo: 130, litro: 260 },
    "Gallo Special": { copeo: 130, litro: 260 },
    "Gallo Giro": { copeo: 130, litro: 260 },
    "Gallo de 1/2": { copeo: 130, litro: 260 },
    "Gallo de Pulgada": { copeo: 130, litro: 260 },
    "Hot Jimmy": { copeo: 130, litro: 260 },
    "Piña Colada Virgen": { copeo: 60, litro: 120 },
    "Limonada Frappé": { copeo: 50, litro: 100 },
    "Limonada Natural": { copeo: 40, litro: 80 },
    "Limonada Mineral": { copeo: 45, litro: 90 },
    "Clericot Virgen": { copeo: 70, litro: 130 },
    "Refresco": { simple: 30 },
    "Agua": { simple: 25 },
  };
}

function defaultState() {
  return {
    waiters: { names: ['Laura', 'Diego', 'Ana', 'Pepe'], claimedBy: {} },
    tabs: [],
    prices: defaultPrices(), // { "Nombre producto": { simple: 60 } } o { "Nombre": { copeo: 110, litro: 220, botella: 1800 } }
  };
}

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.waiters && Array.isArray(parsed.tabs)) {
        if (!parsed.prices) parsed.prices = {};
        // Rellena precios que falten sin pisar los que el usuario ya haya capturado a mano.
        // Se revisa formato por formato (no solo por nombre), porque algunos nombres se
        // repiten entre categorías (ej. "Maestro Dobel" existe como shot Y como tequila,
        // cada uno con su propia llave de formato).
        const defaults = defaultPrices();
        Object.keys(defaults).forEach((name) => {
          if (!parsed.prices[name]) parsed.prices[name] = {};
          Object.keys(defaults[name]).forEach((formatKey) => {
            if (parsed.prices[name][formatKey] === undefined) {
              parsed.prices[name][formatKey] = defaults[name][formatKey];
            }
          });
        });
        return parsed;
      }
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

app.post('/api/tabs/:id/checkout', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  const { payments, cardTip } = req.body || {};
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'payments requerido' });
  }
  for (const p of payments) {
    if (!['cash', 'card', 'transfer'].includes(p.method)) return res.status(400).json({ error: 'método inválido' });
    if (typeof p.amount !== 'number' || p.amount < 0) return res.status(400).json({ error: 'monto inválido' });
  }
  tab.payments = payments;
  tab.cardTip = Number(cardTip) || 0;
  tab.status = 'closed';
  tab.closedAt = new Date().toISOString();
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

app.post('/api/prices/set', (req, res) => {
  const { name, format, price } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name requerido' });
  const num = Number(price);
  if (isNaN(num) || num < 0) return res.status(400).json({ error: 'precio inválido' });
  const key = format || 'simple';
  if (!state.prices[name]) state.prices[name] = {};
  state.prices[name][key] = num;
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
