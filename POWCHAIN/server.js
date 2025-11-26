const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

// ======== ÉTAT POWCHAIN GLOBAL ========
let state = {
  height: 0,
  pow: 1000000,           // POW en circulation (ex: côté LP)
  lp: 100000,             // USDC POW en réserve LP
  price: 1,               // prix POW en USDC POW
  producer: "TREASURY_POWCHAIN",
  blocks: [],
  txs: []
};

// wallets POWCHAIN locaux : pub => { pow, usdc, nonce }
const wallets = {};

// pool LP pour le swap x*y = k
const lp = {
  pow: state.pow,
  usdc: state.lp
};

function recalcPrice() {
  if (lp.pow <= 0) lp.pow = 1;
  state.pow = lp.pow;
  state.lp = lp.usdc;
  state.price = lp.usdc / lp.pow;
}

function getWallet(pub) {
  if (!wallets[pub]) {
    wallets[pub] = { pow: 0, usdc: 0, nonce: 0 };
  }
  return wallets[pub];
}

function pushTx(tx) {
  const full = {
    id: "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
    ts: Date.now(),
    ...tx
  };
  state.txs.push(full);
  if (state.txs.length > 200) state.txs.shift();
  const payload = JSON.stringify({ type: "tx", tx: full });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(payload);
  });
}

// ======== API /stats (graph + explorer) ========
app.get("/stats", (req, res) => {
  res.json({
    pow: state.pow,
    lp: state.lp,
    price: state.price,
    producer: state.producer,
    height: state.height,
    blocks: state.blocks.slice(-30),
    txs: state.txs.slice(-30)
  });
});

// ======== WEBSOCKET /ws ========
const wss = new WebSocket.Server({ server, path: "/ws" });

wss.on("connection", ws => {
  console.log("WS client connecté");

  // état de base
  ws.send(JSON.stringify({ type: "chain", ...state }));

  // derniers blocs
  state.blocks.slice(-20).forEach(b => {
    ws.send(JSON.stringify({ type: "block", block: b }));
  });

  // dernières TX
  state.txs.slice(-20).forEach(t => {
    ws.send(JSON.stringify({ type: "tx", tx: t }));
  });

  ws.on("message", msg => {
    let d;
    try { d = JSON.parse(msg.toString()); } catch { return; }

    // simple ping/pong
    if (d.type === "ping") {
      return ws.send(JSON.stringify({ type: "pong" }));
    }

    // sync wallet : renvoie soldes POWCHAIN
    if (d.type === "sync_wallet" && d.pub) {
      const w = getWallet(d.pub);
      return ws.send(JSON.stringify({
        type: "wallet",
        pub: d.pub,
        pow: w.pow,
        usdc: w.usdc,
        nonce: w.nonce
      }));
    }

    // BRIDGE : USDC (Solana) -> USDC POW (simulation)
    if (d.type === "bridge" && d.pub && d.token === "USDC" && d.amount > 0) {
      const w = getWallet(d.pub);
      w.usdc += Number(d.amount);
      pushTx({ kind: "BRIDGE_USDC_IN", from: d.pub, to: d.pub, amount: d.amount, token: "USDC_POW" });
      ws.send(JSON.stringify({
        type: "wallet",
        pub: d.pub,
        pow: w.pow,
        usdc: w.usdc,
        nonce: w.nonce
      }));
      return;
    }

    // SWAP POW <-> USDC POW via AMM x*y = k (sans frais)
    if (d.type === "swap" && d.pub && d.direction && d.amount > 0) {
      const amount = Number(d.amount);
      const w = getWallet(d.pub);
      const k = lp.pow * lp.usdc || 1;

      if (d.direction === "powToUsdc") {
        if (w.pow < amount) {
          return ws.send(JSON.stringify({ type: "swap_error", msg: "POW insuffisant" }));
        }
        lp.pow += amount;
        const newUsdc = k / lp.pow;
        const out = lp.usdc - newUsdc;
        if (out <= 0) return;
        lp.usdc = newUsdc;
        w.pow -= amount;
        w.usdc += out;
        recalcPrice();
        pushTx({ kind: "SWAP", side: "POW->USDC", from: d.pub, to: d.pub, amountIn: amount, amountOut: out, tokenIn: "POW", tokenOut: "USDC_POW" });
      }

      if (d.direction === "usdcToPow") {
        if (w.usdc < amount) {
          return ws.send(JSON.stringify({ type: "swap_error", msg: "USDC POW insuffisant" }));
        }
        lp.usdc += amount;
        const newPow = k / lp.usdc;
        const out = lp.pow - newPow;
        if (out <= 0) return;
        lp.pow = newPow;
        w.usdc -= amount;
        w.pow += out;
        recalcPrice();
        pushTx({ kind: "SWAP", side: "USDC->POW", from: d.pub, to: d.pub, amountIn: amount, amountOut: out, tokenIn: "USDC_POW", tokenOut: "POW" });
      }

      ws.send(JSON.stringify({
        type: "wallet",
        pub: d.pub,
        pow: w.pow,
        usdc: w.usdc,
        nonce: w.nonce
      }));
      // broadcast nouveau state pour graph
      const payloadChain = JSON.stringify({ type: "chain", ...state });
      wss.clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(payloadChain);
      });
      return;
    }

    // Recherche wallet
    if (d.type === "search_wallet" && d.wallet) {
      const w = wallets[d.wallet] || { pow: 0, usdc: 0, nonce: 0 };
      return ws.send(JSON.stringify({
        type: "wallet_info",
        pub: d.wallet,
        pow: w.pow,
        usdc: w.usdc,
        nonce: w.nonce
      }));
    }

    // Recherche TX simple par id
    if (d.type === "search_tx" && d.id) {
      const tx = state.txs.find(t => t.id === d.id);
      return ws.send(JSON.stringify({
        type: "tx_info",
        id: d.id,
        found: !!tx,
        tx: tx || null
      }));
    }
  });
});

// ======== PRODUCTION DE BLOCS ========
setInterval(() => {
  state.height++;
  const block = {
    height: state.height,
    producer: state.producer,
    ts: Date.now()
  };
  state.blocks.push(block);
  if (state.blocks.length > 500) state.blocks.shift();

  const payloadBlock = JSON.stringify({ type: "block", block });
  const payloadChain = JSON.stringify({ type: "chain", ...state });

  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(payloadBlock);
      c.send(payloadChain);
    }
  });

  console.log("Bloc", state.height);
}, 5000);

// ======== LANCEMENT SERVEUR ========
const PORT = 3000;
server.listen(PORT, () => {
  console.log("POWCHAIN v2 + LP + SWAP + BRIDGE running on port", PORT);
});