# Gallo POS — Servidor

Backend real (Node + Express + WebSocket) para que la app de Gallo
sincronice en vivo entre el celular de los meseros y tu computadora.

## Qué incluye

- `server.js` — el servidor: guarda meseros y cuentas, y avisa a todos
  los dispositivos conectados en cuanto algo cambia.
- `public/index.html` — la app (la misma que ya conoces, ahora
  conectada a este servidor en vez de a la nube de Claude).
- `data.json` — donde se guarda la información (se crea solo).

## Cómo subirlo a Railway (gratis para empezar)

1. Crea una cuenta en https://railway.app (puedes entrar con GitHub).
2. Sube esta carpeta (`gallo-server`) a un repositorio de GitHub.
   - Si no sabes cómo, dímelo y te guío paso a paso.
3. En Railway: "New Project" → "Deploy from GitHub repo" → elige el
   repositorio que acabas de subir.
4. Railway detecta que es Node.js automáticamente y lo instala y
   arranca solo (usa el "start" que ya está en `package.json`).
5. Cuando termine, Railway te da una URL pública (algo como
   `gallo-pos-production.up.railway.app`). Esa es la liga que vas a
   abrir tanto en el celular de los meseros como en tu computadora.

Railway te da unas horas gratis al mes para probar. Cuando decidas
dejarlo corriendo todos los días en Gallo, ahí es cuando entra el
costo de $5-20 USD/mes que platicamos.

## Probarlo en tu computadora antes de subirlo (opcional)

Si tienes Node.js instalado en tu compu:

```
cd gallo-server
npm install
npm start
```

Y abres http://localhost:3000 en el navegador.
