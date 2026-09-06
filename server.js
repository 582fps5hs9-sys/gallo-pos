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

// Página del cliente al escanear el QR de su mesa — misma app, pero la ruta
// especial le dice al frontend que muestre la pantalla de pedido sin login.
app.get('/mesa/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

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

// Catálogo inicial de insumos de barra — el alcohol se lleva en onzas (así se conecta
// directo con las recetas de cócteles), todo lo demás en piezas. Se puede ajustar cualquier
// unidad después desde Inventario; esto solo rellena lo que falte, nunca pisa lo que el
// usuario ya haya capturado a mano (ver migración en loadState).
function defaultIngredients() {
  const pieza = (name) => ({ name, unit: 'pieza', stock: 0, code: '' });
  const oz = (name) => ({ name, unit: 'oz', stock: 0, code: '' });
  const list = [
    // Refrescos y bebidas
    pieza('Coca-Cola'), pieza('Sprite chica'), pieza('Sprite grande'),
    pieza('Fresca chica'), pieza('Fresca grande'), pieza('Agua natural'),
    pieza('Agua mineral chica'), pieza('Agua mineral grande'), pieza('Boss'), pieza('Clamato'),
    // Jugos, frutas y mezcladores
    pieza('Limón natural'), pieza('Jugo de limón'), pieza('Jugo de piña'),
    pieza('Jugo de mango'), pieza('Jugo de arándano'), pieza('Naranja natural'),
    pieza('Manzana natural'), pieza('Fresas naturales'), pieza('Hierbabuena'),
    pieza('Frutos congelados'), pieza('Calahua'), pieza('Granadina'), pieza('Endulzante'),
    pieza('Chantilly'), pieza('Concentrado de jamaica'), pieza('Concentrado de horchata'),
    pieza('Concentrado de tamarindo'), pieza('Concentrado de mango'),
    // Salsas y complementos
    pieza('Tajín'), pieza('Sal'), pieza('Chamoy'), pieza('Salsa Maggi'),
    pieza('Salsa inglesa'), pieza('Tabasco'), pieza('Pimienta limón'), pieza('Viuda de Sánchez'),
    // Alcohol (en onzas — botella completa se resuelve con receta especial más adelante)
    oz('Tequila económico'), oz('Don Julio'), oz('Maestro'), oz('Vodka Oso Negro'),
    oz('Ginebra Oso Negro'), oz('Mezcal económico'), oz('Jägermeister'), oz("Buchanan's 12"),
    oz("Buchanan's piña"), oz('Bacardí de mango'), oz('Etiqueta Negra'), oz('Lambrusco'),
    oz('Smirnoff Tamarindo'), oz('Jack Daniels'), oz('Curaçao azul'), oz('Controy'), oz('Chivas Regal'),
    // Desechables / limpieza
    pieza('Vasos de plástico 1 lt'), pieza('Vasos perlas negras'), pieza('Vasos shots'),
    pieza('Tapones para bebidas'), pieza('Jabón líquido para vasos'),
  ];
  const result = {};
  list.forEach((item, idx) => {
    result['ing_seed_' + idx] = item;
  });
  return result;
}

function defaultState() {
  return {
    waiters: { names: ['Laura', 'Diego', 'Ana', 'Pepe'], claimedBy: {} },
    tabs: [],
    prices: defaultPrices(), // { "Nombre producto": { simple: 60 } } o { "Nombre": { copeo: 110, litro: 220, botella: 1800 } }
    shift: null, // { startingCash, openedAt, cashMovements: [{id, type:'entrada'|'salida', amount, concept, at}] }
    ingredients: defaultIngredients(), // { id: { name, unit: 'oz'|'ml'|'pieza', stock: number } }
    recipes: {}, // { "Nombre producto|formato": [{ ingredientId, qty }] }
    litroCupIngredientId: null, // ingrediente marcado como "vaso de litro" — se descuenta 1 automático por cada venta en formato litro
    shiftHistory: [], // [{ id, startingCash, openedAt, closedAt, cashMovements }] — turnos ya cerrados, para poder revisarlos después
    events: [], // [{ id, name, date: 'YYYY-MM-DD', createdAt }] — grupos en vivo por fecha, para cruzar con ventas
    tables: [], // [{ id, name, slug }] — mesas fijas con QR para que el cliente ordene directo
    ticketConfig: {
      businessName: 'GALLO',
      tagline: 'Restaurant · Sport · Bar',
      extraLine: '',
      footerReceipt: '¡Gracias por tu visita!',
      footerPreCuenta: 'Esta es solo una vista previa — la cuenta sigue abierta.',
      footerComanda: 'Para preparar en barra',
      paperWidth: 300,
      showLogo: true,
    },
    ratings: [], // [{ id, tabId, table, waiter, stars, comment, createdAt }] — el mesero NUNCA ve esto, solo admin
    coupons: [], // [{ code, percent, createdAt, usedAt, tabId }] — premios ganados al calificar, para la siguiente visita
  };
}

function loadState() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.waiters && Array.isArray(parsed.tabs)) {
        if (!parsed.prices) parsed.prices = {};
        if (parsed.shift === undefined) parsed.shift = null;
        if (!parsed.ingredients) parsed.ingredients = {};
        if (!parsed.recipes) parsed.recipes = {};
        if (parsed.litroCupIngredientId === undefined) parsed.litroCupIngredientId = null;
        if (!Array.isArray(parsed.shiftHistory)) parsed.shiftHistory = [];
        if (!Array.isArray(parsed.events)) parsed.events = [];
        if (!Array.isArray(parsed.tables)) parsed.tables = [];
        if (!parsed.ticketConfig) {
          parsed.ticketConfig = {
            businessName: 'GALLO', tagline: 'Restaurant · Sport · Bar', extraLine: '',
            footerReceipt: '¡Gracias por tu visita!',
            footerPreCuenta: 'Esta es solo una vista previa — la cuenta sigue abierta.',
            footerComanda: 'Para preparar en barra', paperWidth: 300, showLogo: true,
          };
        }
        if (!Array.isArray(parsed.ratings)) parsed.ratings = [];
        if (!Array.isArray(parsed.coupons)) parsed.coupons = [];
        // Agrega al catálogo de insumos los que falten (por nombre), sin tocar los que
        // el usuario ya haya dado de alta a mano ni pisar su existencia capturada.
        if (!parsed.ingredients) parsed.ingredients = {};
        Object.values(parsed.ingredients).forEach((ing) => { if (ing.code === undefined) ing.code = ''; });
        const existingIngredientNames = new Set(Object.values(parsed.ingredients).map((i) => i.name));
        Object.entries(defaultIngredients()).forEach(([id, ing]) => {
          if (!existingIngredientNames.has(ing.name)) {
            let finalId = id;
            let n = 1;
            while (parsed.ingredients[finalId]) { finalId = id + '_' + n; n += 1; }
            parsed.ingredients[finalId] = ing;
          }
        });
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

app.post('/api/shift/open', (req, res) => {
  const { startingCash } = req.body || {};
  const num = Number(startingCash);
  if (isNaN(num) || num < 0) return res.status(400).json({ error: 'fondo de caja inválido' });
  state.shift = { startingCash: num, openedAt: new Date().toISOString(), cashMovements: [] };
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/shift/movement', (req, res) => {
  if (!state.shift) return res.status(400).json({ error: 'no hay turno abierto' });
  const { type, amount, concept } = req.body || {};
  if (!['entrada', 'salida'].includes(type)) return res.status(400).json({ error: 'tipo inválido' });
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return res.status(400).json({ error: 'monto inválido' });
  state.shift.cashMovements.push({
    id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type,
    amount: num,
    concept: String(concept || '').trim(),
    at: new Date().toISOString(),
  });
  persistAndBroadcast();
  res.json({ ok: true, state });
});

function getPrice(name, format) {
  const key = format || 'simple';
  const p = state.prices[name] && state.prices[name][key];
  return typeof p === 'number' ? p : 0;
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Premios al calificar — de cada 70 calificaciones: 3 sacan 10%, 5 sacan 8%, 15 sacan 5%,
// las 47 restantes no ganan nada esta vez (pero siguen contando para el reporte de admin).
const REWARD_TIERS = [
  { percent: 10, weight: 3 },
  { percent: 8, weight: 5 },
  { percent: 5, weight: 15 },
  { percent: 0, weight: 47 },
];
const REWARD_TOTAL_WEIGHT = REWARD_TIERS.reduce((s, t) => s + t.weight, 0);

function rollReward() {
  let roll = Math.random() * REWARD_TOTAL_WEIGHT;
  for (const tier of REWARD_TIERS) {
    if (roll < tier.weight) return tier.percent;
    roll -= tier.weight;
  }
  return 0;
}

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1 para que no se confundan al leerlo
  let code = 'GALLO-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

app.post('/api/tabs/:id/rate', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  if (tab.rated) return res.status(400).json({ error: 'esta cuenta ya fue calificada' });
  const { stars, comment } = req.body || {};
  const numStars = Number(stars);
  if (!Number.isInteger(numStars) || numStars < 1 || numStars > 5) {
    return res.status(400).json({ error: 'calificación inválida' });
  }
  state.ratings.push({
    id: 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    tabId: tab.id,
    table: tab.table,
    waiter: tab.waiter,
    stars: numStars,
    comment: comment ? String(comment).slice(0, 300) : '',
    createdAt: new Date().toISOString(),
  });
  tab.rated = true;

  const percent = rollReward();
  let code = null;
  if (percent > 0) {
    code = generateCouponCode();
    state.coupons.push({ code, percent, createdAt: new Date().toISOString(), usedAt: null, tabId: tab.id });
  }
  persistAndBroadcast();
  res.json({ ok: true, won: percent > 0, percent, code, state });
});

app.post('/api/coupons/validate', (req, res) => {
  const { code } = req.body || {};
  const coupon = state.coupons.find((c) => c.code === String(code || '').trim().toUpperCase());
  if (!coupon) return res.status(404).json({ error: 'cupón no encontrado' });
  if (coupon.usedAt) return res.status(400).json({ error: 'este cupón ya fue usado' });
  res.json({ ok: true, percent: coupon.percent });
});

app.post('/api/ticket-config/set', (req, res) => {
  const allowedKeys = ['businessName', 'tagline', 'extraLine', 'footerReceipt', 'footerPreCuenta', 'footerComanda', 'paperWidth', 'showLogo'];
  const body = req.body || {};
  allowedKeys.forEach((key) => {
    if (body[key] !== undefined) {
      if (key === 'paperWidth') {
        const num = Number(body[key]);
        if (!isNaN(num) && num >= 150 && num <= 500) state.ticketConfig[key] = num;
      } else if (key === 'showLogo') {
        state.ticketConfig[key] = !!body[key];
      } else {
        state.ticketConfig[key] = String(body[key]);
      }
    }
  });
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/tables/add', (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'nombre requerido' });
  const clean = String(name).trim();
  let slug = slugify(clean) || 'mesa';
  let n = 1;
  const existingSlugs = state.tables.map((t) => t.slug);
  let finalSlug = slug;
  while (existingSlugs.includes(finalSlug)) { n += 1; finalSlug = slug + '-' + n; }
  const id = 'tbl_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.tables.push({ id, name: clean, slug: finalSlug });
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/tables/:id/remove', (req, res) => {
  state.tables = state.tables.filter((t) => t.id !== req.params.id);
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/customer-order', (req, res) => {
  const { tableSlug, items } = req.body || {};
  const table = state.tables.find((t) => t.slug === tableSlug);
  if (!table) return res.status(404).json({ error: 'mesa no encontrada' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'pedido vacío' });

  // Si ya hay CUALQUIER cuenta abierta para esta mesa (tenga mesero asignado o no), el pedido
  // se le suma ahí — así el cliente puede volver a escanear y pedir más sin que el mesero
  // tenga que acercarse de nuevo. Solo se crea una cuenta nueva si de plano no hay ninguna abierta.
  let tab = state.tabs.find((t) => t.status === 'open' && t.table === table.name);
  if (!tab) {
    tab = {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      waiter: 'Sin asignar',
      table: table.name,
      status: 'open',
      items: [],
      createdAt: new Date().toISOString(),
      fromCustomer: true,
    };
    state.tabs.push(tab);
  }
  items.forEach((it) => {
    tab.items.push({
      id: 'i_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: it.name,
      format: it.format || null,
      qty: it.qty,
      note: it.note || '',
      category: null,
      price: getPrice(it.name, it.format),
    });
  });
  // Si la cuenta ya tenía mesero asignado, se marca para avisarle que llegó pedido nuevo del
  // cliente — si sigue "Sin asignar" no hace falta, ya la ve cualquiera en su lista de pendientes.
  if (tab.waiter !== 'Sin asignar') {
    tab.notifyWaiter = true;
  }
  persistAndBroadcast();
  res.json({ ok: true, tabId: tab.id, state });
});

app.post('/api/tabs/:id/seen', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  tab.notifyWaiter = false;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/tabs/:id/assign', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  const { waiter } = req.body || {};
  if (!waiter || !String(waiter).trim()) return res.status(400).json({ error: 'mesero requerido' });
  tab.waiter = String(waiter).trim();
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/events/add', (req, res) => {
  const { name, date } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'nombre requerido' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'fecha inválida' });
  const id = 'evt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.events.push({ id, name: String(name).trim(), date, createdAt: new Date().toISOString() });
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/events/:id/remove', (req, res) => {
  state.events = state.events.filter((e) => e.id !== req.params.id);
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/shift/close', (req, res) => {
  if (state.shift) {
    state.shiftHistory.push({
      id: 'shift_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      startingCash: state.shift.startingCash,
      openedAt: state.shift.openedAt,
      closedAt: new Date().toISOString(),
      cashMovements: state.shift.cashMovements,
    });
  }
  state.waiters.claimedBy = {};
  state.shift = null;
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

function deductInventoryForTab(tab) {
  (tab.items || []).forEach((item) => {
    const key = item.name + '|' + (item.format || 'simple');
    const recipe = state.recipes[key];
    if (recipe) {
      recipe.forEach((r) => {
        const ing = state.ingredients[r.ingredientId];
        if (ing) ing.stock -= r.qty * item.qty;
      });
    }
    // Regla automática: cada bebida vendida en formato "litro" gasta un vaso desechable,
    // sin necesidad de agregarlo a mano en cada receta.
    if (item.format === 'litro' && state.litroCupIngredientId) {
      const cup = state.ingredients[state.litroCupIngredientId];
      if (cup) cup.stock -= item.qty;
    }
  });
}

app.post('/api/tabs/:id/checkout', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  const { payments, cardTip, couponCode } = req.body || {};
  if (!Array.isArray(payments) || payments.length === 0) {
    return res.status(400).json({ error: 'payments requerido' });
  }
  for (const p of payments) {
    if (!['cash', 'card', 'transfer'].includes(p.method)) return res.status(400).json({ error: 'método inválido' });
    if (typeof p.amount !== 'number' || p.amount < 0) return res.status(400).json({ error: 'monto inválido' });
  }
  if (couponCode) {
    const coupon = state.coupons.find((c) => c.code === String(couponCode).trim().toUpperCase());
    if (!coupon) return res.status(400).json({ error: 'cupón no encontrado' });
    if (coupon.usedAt) return res.status(400).json({ error: 'este cupón ya fue usado' });
    coupon.usedAt = new Date().toISOString();
    tab.discountApplied = { code: coupon.code, percent: coupon.percent };
  }
  tab.payments = payments;
  tab.cardTip = Number(cardTip) || 0;
  tab.status = 'closed';
  tab.closedAt = new Date().toISOString();
  deductInventoryForTab(tab);
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/tabs/:id/cancel', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  if (tab.status !== 'closed') return res.status(400).json({ error: 'solo se puede cancelar una venta ya cobrada' });
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) return res.status(400).json({ error: 'motivo requerido' });
  tab.status = 'cancelled';
  tab.cancelReason = String(reason).trim();
  tab.cancelledAt = new Date().toISOString();
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.patch('/api/tabs/:id/status', (req, res) => {
  const tab = state.tabs.find((t) => t.id === req.params.id);
  if (!tab) return res.status(404).json({ error: 'cuenta no encontrada' });
  tab.status = req.body.status;
  if (req.body.status === 'closed' && !tab.closedAt) tab.closedAt = new Date().toISOString();
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/ingredients/add', (req, res) => {
  const { name, unit, code } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'nombre requerido' });
  if (!['oz', 'ml', 'pieza'].includes(unit)) return res.status(400).json({ error: 'unidad inválida' });
  const clean = String(name).trim();
  const exists = Object.values(state.ingredients).some((i) => i.name.toLowerCase() === clean.toLowerCase());
  if (exists) return res.status(409).json({ error: 'ya existe un ingrediente con ese nombre' });
  const cleanCode = code ? String(code).trim() : '';
  if (cleanCode && Object.values(state.ingredients).some((i) => i.code === cleanCode)) {
    return res.status(409).json({ error: 'ese código ya está en uso' });
  }
  const id = 'ing_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.ingredients[id] = { name: clean, unit, stock: 0, code: cleanCode };
  persistAndBroadcast();
  res.json({ ok: true, id, state });
});

app.post('/api/ingredients/:id/set-code', (req, res) => {
  const ing = state.ingredients[req.params.id];
  if (!ing) return res.status(404).json({ error: 'ingrediente no encontrado' });
  const cleanCode = (req.body || {}).code ? String(req.body.code).trim() : '';
  if (cleanCode && Object.values(state.ingredients).some((i) => i !== ing && i.code === cleanCode)) {
    return res.status(409).json({ error: 'ese código ya está en uso por otro producto' });
  }
  ing.code = cleanCode;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/ingredients/:id/restock', (req, res) => {
  const ing = state.ingredients[req.params.id];
  if (!ing) return res.status(404).json({ error: 'ingrediente no encontrado' });
  const amount = Number((req.body || {}).amount);
  if (isNaN(amount) || amount === 0) return res.status(400).json({ error: 'cantidad inválida' });
  ing.stock += amount;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/ingredients/:id/remove', (req, res) => {
  if (!state.ingredients[req.params.id]) return res.status(404).json({ error: 'ingrediente no encontrado' });
  delete state.ingredients[req.params.id];
  // limpia cualquier receta que lo use
  Object.keys(state.recipes).forEach((key) => {
    state.recipes[key] = state.recipes[key].filter((r) => r.ingredientId !== req.params.id);
  });
  if (state.litroCupIngredientId === req.params.id) state.litroCupIngredientId = null;
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/ingredients/:id/set-litro-cup', (req, res) => {
  const { value } = req.body || {};
  if (value) {
    if (!state.ingredients[req.params.id]) return res.status(404).json({ error: 'ingrediente no encontrado' });
    state.litroCupIngredientId = req.params.id;
  } else if (state.litroCupIngredientId === req.params.id) {
    state.litroCupIngredientId = null;
  }
  persistAndBroadcast();
  res.json({ ok: true, state });
});

app.post('/api/recipes/set', (req, res) => {
  const { productKey, ingredients } = req.body || {};
  if (!productKey || !Array.isArray(ingredients)) return res.status(400).json({ error: 'datos inválidos' });
  for (const r of ingredients) {
    if (!state.ingredients[r.ingredientId]) return res.status(400).json({ error: 'ingrediente inválido en la receta' });
    if (typeof r.qty !== 'number' || r.qty <= 0) return res.status(400).json({ error: 'cantidad inválida en la receta' });
  }
  state.recipes[productKey] = ingredients.map((r) => ({ ingredientId: r.ingredientId, qty: r.qty }));
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
