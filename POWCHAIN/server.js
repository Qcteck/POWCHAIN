// server.js — POWCHAIN Validator sécurisé + API + LP + Bridge + Proof-of-Reserves + P2P
// API HTTP : http://0.0.0.0:3000
// WS       : ws://0.0.0.0:2053 (clients + P2P)

const http = require("http");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const os = require("os");

// ------- CONFIG -------
const HTTP_PORT = 3000;
const WS_PORT = 2053;
const TREASURY_SOLANA = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

const NODE_ID =
  process.env.POWCHAIN_NODE_ID ||
  (os.hostname() + "-" + Math.random().toString(36).slice(2, 8));

const SEED_PEERS = (process.env.POWCHAIN_PEERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// ------- ÉTAT GLOBAL -------
let height = 0;
let lastBlock = Date.now();

const wallets = new Map(); // addr → {pow, usdcPow, staked, nonce, unlockAt}
const treasury = {
  sol: 0,          // SOL réels (observés via explorer / RPC)
  pending: 0,      // SOL annoncés (bridge) en attente de preuve
  usdcPow: 1_000_000,
  pow: 0
};

function getWallet(addr) {
  if (!wallets.has(addr)) {
    wallets.set(addr, {
      pow: 0,
      usdcPow: 0,
      staked: 0,
      nonce: 0,
      unlockAt: 0
    });
  }
  return wallets.get(addr);
}

function computeTVL() {
  let x = treasury.usdcPow;
  for (const w of wallets.values()) x += w.usdcPow;
  return x;
}

function pricePOW() {
  const tvl = computeTVL();
  if (tvl <= 0) return 1;
  return Math.max(1, Number((tvl / 1_000_000).toFixed(6)));
}

// ------- API HTTP -------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    nodeId: NODE_ID,
    height,
    lastBlock,
    price: pricePOW()
  });
});

app.get("/stats", (req, res) => {
  res.json({
    nodeId: NODE_ID,
    height,
    tvl: computeTVL(),
    price: pricePOW(),
    treasury
  });
});

app.get("/wallet/:addr", (req, res) => {
  res.json(getWallet(req.params.addr));
});

// P2P — découverte dynamique de pairs
const peerSockets = new Map(); // url -> ws

app.get("/peers", (req, res) => {
  res.json({
    nodeId: NODE_ID,
    peers: Array.from(peerSockets.keys()),
    seeds: SEED_PEERS
  });
});

app.post("/peers", (req, res) => {
  const url =
    (req.body && req.body.url)
      ? String(req.body.url).trim()
      : "";
  if (!url) return res.status(400).json({ error: "missing url" });
  connectToPeer(url);
  res.json({ ok: true });
});

const api = http.createServer(app).listen(HTTP_PORT, () => {
  console.log("🌐 API POWCHAIN OK sur le port", HTTP_PORT);
});

// ------- SÉCURITÉ MEMPOOL -------
let mempoolCount = 0;
const MAX_MEMPOOL = 2000;
const MAX_TX_PER_WALLET = 50;
const txCountByWallet = new Map();

// ------- WEBSOCKET VALIDATOR + CLIENTS -------
const wss = new WebSocket.Server({ port: WS_PORT }, () => {
  console.log("🛰 WS POWCHAIN OK sur le port", WS_PORT);
});

function broadcastToClients(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function broadcastToPeers(payload) {
  const msg = JSON.stringify(payload);
  for (const [, ws] of peerSockets) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

function broadcastState() {
  const payload = {
    t: "state",
    nodeId: NODE_ID,
    height,
    price: pricePOW(),
    treasury
  };
  broadcastToClients(payload);
  broadcastToPeers(payload);
}

// ------- COEUR : TRAITEMENT DES TRANSACTIONS -------
function handleTx(tx, fromPeer = false) {
  if (!tx || !tx.type || !tx.from || typeof tx.nonce !== "number") return;

  const w = getWallet(tx.from);
  if (tx.nonce !== w.nonce + 1) return;

  // Anti-flood (seulement si TX vient d’un client)
  if (!fromPeer) {
    if (mempoolCount > MAX_MEMPOOL) return;
    const count = txCountByWallet.get(tx.from) || 0;
    if (count > MAX_TX_PER_WALLET) return;
    txCountByWallet.set(tx.from, count + 1);
    mempoolCount++;
  }

  // Vérification ED25519
  try {
    const msg = new TextEncoder().encode(
      JSON.stringify({
        type: tx.type,
        from: tx.from,
        to: tx.to ?? null,
        amount: tx.amount ?? null,
        nonce: tx.nonce
      })
    );
    const sig = bs58.decode(tx.sig);
    const pub = bs58.decode(tx.pub);
    if (!nacl.sign.detached.verify(msg, sig, pub)) return;
  } catch {
    return;
  }

  // TX acceptée
  w.nonce++;

  // ====== LOGIQUE ÉCONOMIQUE ======

  // Bridge SOL → crédit POW seulement si reserves SOL confirmées
  if (tx.type === "bridgeSOL") {
    treasury.pending += tx.amount;
    if (treasury.pending <= treasury.sol) {
      const powToCredit = tx.amount * 1; // ratio 1:1 ici
      w.pow += powToCredit;
      treasury.pow -= powToCredit;
    }
  }

  // Swap USDC → POW
  if (tx.type === "swapUSDCtoPOW") {
    if (w.usdcPow < tx.amount) return;
    const p = pricePOW();
    const out = tx.amount / p;
    w.usdcPow -= tx.amount;
    w.pow += out;
    treasury.usdcPow += tx.amount;
  }

  // Swap POW → USDC
  if (tx.type === "swapPOWtoUSDC") {
    if (w.pow < tx.amount) return;
    const p = pricePOW();
    const out = tx.amount * p;
    if (treasury.usdcPow < out) return;
    w.pow -= tx.amount;
    w.usdcPow += out;
    treasury.usdcPow -= out;
  }

  // Staking
  if (tx.type === "stake") {
    if (w.pow < tx.amount) return;
    w.pow -= tx.amount;
    w.staked += tx.amount;
    w.unlockAt = Date.now() + 3600_000; // 1h de lock
  }

  // Unstake sécurisé
  if (tx.type === "unstake") {
    if (Date.now() < w.unlockAt) return;
    w.pow += w.staked;
    w.staked = 0;
  }

  // Production de bloc logique : toutes les 5 TX par wallet
  if (w.nonce % 5 === 0) {
    height++;
    lastBlock = Date.now();
  }

  // Propagation P2P de la TX (si elle vient d’un client local)
  if (!fromPeer) {
    broadcastToPeers({ t: "txForward", tx });
  }

  // Mise à jour globale
  broadcastState();
}

// ------- WS HANDLER (clients + nœuds + chat) -------
wss.on("connection", ws => {
  ws.send(
    JSON.stringify({
      t: "hello",
      nodeId: NODE_ID,
      height,
      price: pricePOW()
    })
  );

  ws.on("message", raw => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Messages P2P "hello" entre nœuds
    if (msg.t === "helloNode") {
      return;
    }

    // TX relayée par un autre nœud
    if (msg.t === "txForward" && msg.tx) {
      return handleTx(msg.tx, true);
    }

    // Chat utilisateur local (chat réseau simple)
    if (msg.t === "chat" && typeof msg.msg === "string") {
      const payload = {
        t: "chat",
        from: msg.from || NODE_ID,
        msg: msg.msg,
        time: Date.now()
      };
      broadcastToClients(payload);
      return;
    }

    // Sinon, on considère que c’est une TX d’un client
    handleTx(msg, false);
  });
});

// ------- P2P SORTANT -------
function connectToPeer(url) {
  if (!url || peerSockets.has(url)) return;
  try {
    const ws = new WebSocket(url);

    ws.on("open", () => {
      console.log("🤝 P2P connecté à", url);
      peerSockets.set(url, ws);
      ws.send(
        JSON.stringify({
          t: "helloNode",
          nodeId: NODE_ID,
          height
        })
      );
    });

    ws.on("message", raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.t === "txForward" && msg.tx) {
        handleTx(msg.tx, true);
      }

      if (msg.t === "state" && typeof msg.height === "number") {
        // plus tard : logique de reorg / meilleure chaîne
      }
    });

    ws.on("close", () => {
      console.log("❌ P2P déconnecté de", url);
      peerSockets.delete(url);
    });

    ws.on("error", () => {
      peerSockets.delete(url);
    });
  } catch (e) {
    console.log("Erreur connexion P2P", url);
  }
}

// Connexion automatique aux peers définis en variable d’environnement
SEED_PEERS.forEach(u => connectToPeer(u));

console.log(
  "✅ POWCHAIN validator prêt — nodeId =",
  NODE_ID,
  "| API:",
  HTTP_PORT,
  "| WS:",
  WS_PORT
);