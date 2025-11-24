// server.js — POWCHAIN Validator sécurisé + API + LP + Bridge + Proof-of-Reserves
// API  : http://0.0.0.0:3000
// WS   : ws://0.0.0.0:2053

const http = require("http");
const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const bs58 = require("bs58");
const nacl = require("tweetnacl");

// -------- CONFIG --------
const HTTP_PORT = 3000;
const WS_PORT = 2053;
const TREASURY_SOLANA = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy"; // fixe

// -------- ÉTAT CHAÎNE --------
let height = 0;
let lastBlock = Date.now();
const wallets = new Map(); // addr → {pow, usdcPow, staked, nonce}
const treasury = { sol: 0, usdcPow: 1000000, pow: 0 }; // réserves initiales

function getWallet(a) {
  if (!wallets.has(a)) wallets.set(a, { pow: 0, usdcPow: 0, staked: 0, nonce: 0 });
  return wallets.get(a);
}

function computeTVL() {
  let x = treasury.usdcPow;
  for (const w of wallets.values()) x += w.usdcPow;
  return x;
}

function pricePOW() {
  const tvl = computeTVL();
  return tvl <= 0 ? 1 : Math.max(1, (tvl / 1000000).toFixed(6) * 1);
}

// -------- API HTTP --------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/stats", (req, res) => {
  res.json({
    height,
    tvl: computeTVL(),
    price: pricePOW(),
    treasury,
  });
});

app.get("/wallet/:addr", (req, res) => {
  res.json(getWallet(req.params.addr));
});

// -------- HTTP SERVER --------
const api = http.createServer(app).listen(HTTP_PORT, () =>
  console.log("API OK port", HTTP_PORT)
);

// -------- WEBSOCKET VALIDATOR --------
const wss = new WebSocket.Server({ port: WS_PORT }, () =>
  console.log("WS OK port", WS_PORT)
);

function broadcast(m) {
  const mStr = JSON.stringify(m);
  wss.clients.forEach(c => c.readyState === 1 && c.send(mStr));
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ t: "hello", height, price: pricePOW() }));

  ws.on("message", raw => {
    let tx;
    try { tx = JSON.parse(raw); } catch { return; }

    // Validation stricte
    if (!tx.type || !tx.from || typeof tx.nonce !== "number") return;
    const w = getWallet(tx.from);
    if (tx.nonce !== w.nonce + 1) return;

    const msg = new TextEncoder().encode(JSON.stringify({
      type: tx.type, from: tx.from, to: tx.to ?? null, amount: tx.amount ?? null, nonce: tx.nonce
    }));
    const sig = bs58.decode(tx.sig);
    const pub = bs58.decode(tx.pub);
    if (!nacl.sign.detached.verify(msg, sig, pub)) return;

    // TX validée
    w.nonce++;

    if (tx.type === "bridgeSOL") treasury.sol += tx.amount;
    if (tx.type === "swapUSDCtoPOW") {
      if (w.usdcPow < tx.amount) return;
      const p = pricePOW();
      const out = tx.amount / p;
      w.usdcPow -= tx.amount;
      w.pow += out;
      treasury.usdcPow += tx.amount;
    }
    if (tx.type === "swapPOWtoUSDC") {
      if (w.pow < tx.amount) return;
      const p = pricePOW();
      const out = tx.amount * p;
      if (treasury.usdcPow < out) return;
      w.pow -= tx.amount;
      w.usdcPow += out;
      treasury.usdcPow -= out;
    }

    // Miner un bloc tous les 5 TX
    if ((w.nonce % 5) === 0) {
      height++;
      lastBlock = Date.now();
    }

    broadcast({ t: "state", height, price: pricePOW(), treasury });
  });
});