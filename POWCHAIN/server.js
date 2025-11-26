// POWCHAIN v2 + LP + Bridge + Swap + Explorer
// server.js

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const PORT = 3000;

// -------------------- ÉTAT GLOBAL --------------------
const app = express();
app.use(express.json());

const server = http.createServer(app);

// ⚠️ WebSocket sur /ws (important pour nginx)
const wss = new WebSocket.Server({ server, path: "/ws" });

const TREASURY_POWCHAIN = "TREASURY_POWCHAIN";
const TREASURY_SOL = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

const state = {
  height: 0,
  blocks: [],
  mempool: [],
  wallets: new Map(),
  lp: {
    pow: 1000000,   // réserve POW dans le pool
    usdc: 1000000   // réserve USDC POW dans le pool
  },
  pricePow: 1
};

function getWallet(pub) {
  if (!state.wallets.has(pub)) {
    state.wallets.set(pub, {
      pub,
      pow: 0,
      usdc: 0,   // USDC POW
      lp: 0,
      staked: 0,
      nonce: 0
    });
  }
  return state.wallets.get(pub);
}

// -------------------- BLOCKCHAIN --------------------
function hashBlock(data) {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

function totalSupplyPow() {
  let sum = 0;
  state.wallets.forEach(w => { sum += w.pow; });
  sum += state.lp.pow;
  return sum;
}

function explorerPayload() {
  const last = state.blocks[state.blocks.length - 1];
  return {
    height: state.height,
    producer: last ? last.producer : TREASURY_POWCHAIN,
    hash: last ? last.hash : "GENESIS",
    timestamp: last ? last.timestamp : Date.now(),
    supplyPow: totalSupplyPow(),
    supplyLpPow: state.lp.pow,
    pricePow: state.pricePow,
    mempool: state.mempool
  };
}

function broadcastExplorer() {
  const payload = { type: "explorer", data: explorerPayload() };
  const msg = JSON.stringify(payload);
  wss.clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}

function produceBlock(producer = TREASURY_POWCHAIN) {
  const prev = state.blocks[state.blocks.length - 1];
  const block = {
    index: state.blocks.length,
    prevHash: prev ? prev.hash : "GENESIS",
    timestamp: Date.now(),
    producer,
    txs: state.mempool.splice(0)
  };
  block.hash = hashBlock(block);
  state.blocks.push(block);
  state.height = block.index;

  // mise à jour prix POW (x*y=k)
  if (state.lp.pow > 0) {
    state.pricePow = state.lp.usdc / state.lp.pow;
  } else {
    state.pricePow = 0;
  }

  broadcastExplorer();
  console.log(`Nouveau bloc ${block.index} par ${producer}`);
  return block;
}

// bloc "heartbeat" toutes les 15s pour nourrir le graphe
setInterval(() => {
  produceBlock(TREASURY_POWCHAIN);
}, 15000);

// -------------------- SIG / NONCE --------------------
function verifyTxSig(tx) {
  try {
    const msgObj = {
      type: tx.type,
      from: tx.from,
      to: tx.to ?? null,
      amount: tx.amount ?? null,
      token: tx.token ?? null,
      nonce: tx.nonce
    };
    const msg = new TextEncoder().encode(JSON.stringify(msgObj));
    const sigBytes = bs58.decode(tx.sig);
    const pubBytes = bs58.decode(tx.pub);
    return nacl.sign.detached.verify(msg, sigBytes, pubBytes);
  } catch (e) {
    console.error("verifyTxSig error", e);
    return false;
  }
}

function checkNonce(tx, wallet) {
  return tx.nonce === wallet.nonce + 1;
}

// -------------------- TX HANDLERS --------------------
function applyTransfer(tx) {
  const from = getWallet(tx.from);
  const to = getWallet(tx.to);
  const amount = Number(tx.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
  if (from.pow < amount) throw new Error("Solde POW insuffisant");

  from.pow -= amount;
  to.pow += amount;
}

function applySwapPowToUsdc(tx) {
  const w = getWallet(tx.from);
  const amountIn = Number(tx.amount || 0);
  if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error("Montant invalide");
  if (w.pow < amountIn) throw new Error("Solde POW insuffisant");

  const feeFactor = 0.998;
  const amountAfterFee = amountIn * feeFactor;
  const x = state.lp.pow;
  const y = state.lp.usdc;
  const newX = x + amountAfterFee;
  const newY = (x * y) / newX;
  const amountOut = y - newY;
  if (amountOut <= 0) throw new Error("Swap impossible");

  w.pow -= amountIn;
  w.usdc += amountOut;  // USDC POW reçu

  state.lp.pow = newX;
  state.lp.usdc = newY;
}

function applySwapUsdcToPow(tx) {
  const w = getWallet(tx.from);
  const amountIn = Number(tx.amount || 0);
  if (!Number.isFinite(amountIn) || amountIn <= 0) throw new Error("Montant invalide");
  if (w.usdc < amountIn) throw new Error("Solde USDC POW insuffisant");

  const feeFactor = 0.998;
  const amountAfterFee = amountIn * feeFactor;
  const x = state.lp.usdc;
  const y = state.lp.pow;
  const newX = x + amountAfterFee;
  const newY = (x * y) / newX;
  const amountOut = y - newY;
  if (amountOut <= 0) throw new Error("Swap impossible");

  w.usdc -= amountIn;
  w.pow += amountOut;

  state.lp.usdc = newX;
  state.lp.pow = newY;
}

function applyBridgeSolOut(tx) {
  const w = getWallet(tx.from);
  const amount = Number(tx.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Montant invalide");
  if (w.pow < amount) throw new Error("Solde POW insuffisant");

  w.pow -= amount;
  const t = getWallet(TREASURY_POWCHAIN);
  t.pow += amount;

  console.log(`Demande BRIDGE POWCHAIN → SOL de ${amount} POW pour ${tx.from}`);
}

function processTx(tx) {
  if (!verifyTxSig(tx)) throw new Error("Signature invalide");
  const w = getWallet(tx.from);
  if (!checkNonce(tx, w)) throw new Error("Nonce invalide");

  switch (tx.type) {
    case "transfer":     applyTransfer(tx);      break;
    case "powToUsdc":    applySwapPowToUsdc(tx); break;
    case "usdcToPow":    applySwapUsdcToPow(tx); break;
    case "bridgeSolOut": applyBridgeSolOut(tx);  break;
    default: throw new Error("Type de TX inconnu : " + tx.type);
  }

  w.nonce = tx.nonce;
  state.mempool.push(tx);
  const block = produceBlock(TREASURY_POWCHAIN);
  return block;
}

// -------------------- WS --------------------
function sendWalletState(ws, pub) {
  const w = getWallet(pub);
  ws.send(JSON.stringify({ type: "state", wallet: w }));
}

wss.on("connection", ws => {
  console.log("Client WS connecté");
  ws.send(JSON.stringify({ type: "info", msg: "Bienvenue sur POWCHAIN" }));
  ws.send(JSON.stringify({ type: "explorer", data: explorerPayload() }));

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); }
    catch { console.error("WS JSON invalide"); return; }

    if (msg.type === "explorer") {
      ws.send(JSON.stringify({ type: "explorer", data: explorerPayload() }));
      return;
    }

    if (msg.type === "requestState" && msg.pub) {
      sendWalletState(ws, msg.pub);
      return;
    }

    if (["transfer","powToUsdc","usdcToPow","bridgeSolOut"].includes(msg.type)) {
      try {
        const block = processTx(msg);
        ws.send(JSON.stringify({ type: "info", msg: "TX acceptée, bloc " + block.index }));
        sendWalletState(ws, msg.from);
      } catch (e) {
        console.error("Erreur TX", e);
        ws.send(JSON.stringify({ type: "info", msg: "Erreur TX : " + e.message }));
      }
    }
  });
});

// -------------------- API HTTP --------------------
app.get("/stats", (req, res) => {
  res.json({
    height: state.height,
    nbWallets: state.wallets.size,
    lp: state.lp,
    pricePow: state.pricePow,
    treasurySol: TREASURY_SOL
  });
});

app.get("/api/wallet/:addr", (req, res) => {
  const w = getWallet(req.params.addr);
  res.json(w);
});

app.get("/api/tx/:id", (req, res) => {
  const [bStr,tStr] = req.params.id.split("-");
  const bi = Number(bStr);
  const ti = Number(tStr);
  if (!Number.isInteger(bi) || !Number.isInteger(ti)) {
    return res.status(400).json({ error:"ID invalide" });
  }
  const block = state.blocks[bi];
  if (!block || !block.txs[ti]) {
    return res.status(404).json({ error:"TX introuvable" });
  }
  const tx = block.txs[ti];
  res.json({
    block: bi,
    index: ti,
    tx,
    timestamp: block.timestamp,
    producer: block.producer,
    hash: block.hash
  });
});

// -------------------- START --------------------
server.listen(PORT, () => {
  console.log("POWCHAIN v2 + LP running on port", PORT);
  console.log("POWCHAIN validator + API en ligne sur port 3000");
});