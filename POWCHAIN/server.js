// server.js — POWCHAIN Validator minimal (API + WS)
// API:  http://127.0.0.1:3000
// WS :  ws://0.0.0.0:2053  (exposé en wss://bbqfinance.fun:2053 via Cloudflare)

const http = require("http");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");

// ----------- CONFIG ----------
const HTTP_PORT = 3000;
const WS_PORT = 2053;
const TREASURY_SOLANA = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

// ----------- ÉTAT POWCHAIN ----------
let height = 0;
let lastBlockTime = Date.now();

const wallets = new Map(); // addr -> { pow, usdcPow, staked, nonce }
const treasury = {
  solBridge: 0,       // SOL reçus (bridges)
  usdcPow: 0,         // réserve USDC POW
  pow: 0,             // POW détenus par la trésorerie
};

function getOrCreateWallet(addr) {
  if (!wallets.has(addr)) {
    wallets.set(addr, { pow: 0, usdcPow: 0, staked: 0, nonce: 0 });
  }
  return wallets.get(addr);
}

function computeTVL() {
  let tvl = treasury.usdcPow;
  for (const w of wallets.values()) tvl += w.usdcPow;
  return tvl;
}

function internalPrice() {
  const tvl = computeTVL();
  if (tvl === 0) return 1;
  return 1 + height / 1000; // petite pente, juste un prix interne indicatif
}

// ----------- EXPRESS API ----------
const app = express();
app.use(cors());
app.use(express.json());

// CORS sécurité de base
app.use((req, res, next) => {
  res.setHeader("X-Powchain-Node", "bbqfinance.fun-validator");
  next();
});

// GET /api/state — infos réseau globales
app.get("/api/state", (req, res) => {
  res.json({
    network: "POWCHAIN",
    height,
    tvl: computeTVL(),
    price: internalPrice(),
    lastBlockTime,
    treasury: {
      solBridge: treasury.solBridge,
      usdcPow: treasury.usdcPow,
      pow: treasury.pow,
      solanaAddress: TREASURY_SOLANA,
    },
  });
});

// GET /api/wallet/:addr — infos d’un wallet POWCHAIN
app.get("/api/wallet/:addr", (req, res) => {
  const addr = String(req.params.addr);
  const w = getOrCreateWallet(addr);
  res.json({ addr, ...w });
});

// POST /api/tx — réception de tx simples (SWAP / BRIDGE_MINT)
app.post("/api/tx", (req, res) => {
  try {
    const tx = req.body || {};
    const { type, from, nonce, amount, token } = tx;

    if (!type || !from || typeof nonce !== "number") {
      return res.status(400).json({ ok: false, error: "TX invalide" });
    }

    const w = getOrCreateWallet(from);
    if (nonce <= w.nonce) {
      return res.status(400).json({ ok: false, error: "Nonce non croissant" });
    }

    // Simple anti valeurs folles
    if (amount <= 0 || amount > 1e12) {
      return res.status(400).json({ ok: false, error: "Montant invalide" });
    }

    if (type === "BRIDGE_MINT") {
      // On crédite l’utilisateur en USDC POW
      w.usdcPow += amount;
      treasury.usdcPow += amount;
      treasury.solBridge += tx.solAmount || 0;
      w.nonce = nonce;
      broadcastWallet(from);
      broadcastState();
      return res.json({ ok: true });
    }

    if (type === "SWAP") {
      // DEX interne POW <-> USDC POW ultra simple
      if (token !== "POW" && token !== "USDC_POW") {
        return res.status(400).json({ ok: false, error: "Token inconnu" });
      }
      const price = internalPrice(); // 1 POW ≈ price USDC POW

      if (token === "POW") {
        // L’utilisateur vend POW, reçoit USDC POW
        if (w.pow < amount) {
          return res.status(400).json({ ok: false, error: "POW insuffisant" });
        }
        const out = amount * price;
        w.pow -= amount;
        w.usdcPow += out;
        treasury.pow += amount;
        treasury.usdcPow -= out;
      } else {
        // L’utilisateur vend USDC POW, reçoit POW
        if (w.usdcPow < amount) {
          return res
            .status(400)
            .json({ ok: false, error: "USDC POW insuffisant" });
        }
        const out = amount / price;
        w.usdcPow -= amount;
        w.pow += out;
        treasury.usdcPow += amount;
        treasury.pow -= out;
      }

      w.nonce = nonce;
      broadcastWallet(from);
      broadcastState();
      return res.json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: "Type de TX inconnu" });
  } catch (e) {
    console.error("Erreur /api/tx", e);
    res.status(500).json({ ok: false, error: "Erreur interne" });
  }
});

// GET /api/proof — mini Proof-of-Reserves lecture seule
app.get("/api/proof", (req, res) => {
  res.json({
    treasury: {
      solBridge: treasury.solBridge,
      usdcPow: treasury.usdcPow,
      pow: treasury.pow,
      solanaAddress: TREASURY_SOLANA,
    },
    powchain: {
      tvl: computeTVL(),
      height,
      price: internalPrice(),
    },
  });
});

// HTTP server + attach WS séparé
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, () => {
  console.log("POWCHAIN HTTP API sur port", HTTP_PORT);
});

// ----------- WebSocket ----------
const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log("POWCHAIN WS sur port", WS_PORT);
});

function broadcast(type, payload) {
  const msg = JSON.stringify({ type, ...payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastState() {
  broadcast("state", {
    network: "POWCHAIN",
    height,
    tvl: computeTVL(),
    price: internalPrice(),
    lastBlockTime,
  });
}

function broadcastWallet(addr) {
  const w = wallets.get(addr);
  if (!w) return;
  broadcast("wallet", { addr, ...w });
}

wss.on("connection", (ws) => {
  console.log("Client WS connecté");
  ws.send(
    JSON.stringify({
      type: "hello",
      network: "POWCHAIN",
      height,
      tvl: computeTVL(),
      price: internalPrice(),
    })
  );
});

// ----------- Production de blocs "PoS" simplifiée ----------
setInterval(() => {
  height += 1;
  lastBlockTime = Date.now();
  broadcastState();
}, 5000);