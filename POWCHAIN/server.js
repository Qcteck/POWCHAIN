const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const PORT = 3000;
const WSPORT = 7001;

// ❇️ État blockchain
let chain = [];
let mempool = [];
let height = 1;
let supplyPOW = 100000000;
let lpPOW = 0;
let lpUSDC = 0;

// ❇️ Trésorerie POWCHAIN
let treasury = {
  pow: 0,
  usdc: 0
};

// 📌 Wallets (mapping adresse → {pow,usdc,staked,pub,nonce})
let wallets = {};

// 🔨 Création wallet
function createWallet() {
  const key = nacl.sign.keyPair();
  const pub = bs58.encode(key.publicKey);
  const priv = bs58.encode(key.secretKey);
  wallets[pub] = { pow: 0, usdc: 0, staked: 0, pub, nonce: 0 };
  return { pub, priv };
}

// 🔍 Vérification signature
function verifyTx(tx) {
  try {
    const msg = new TextEncoder().encode(
      JSON.stringify({ type: tx.type, from: tx.from, to: tx.to ?? null, amount: tx.amount ?? null, token: tx.token ?? null, nonce: tx.nonce })
    );
    return nacl.sign.detached.verify(msg, bs58.decode(tx.sig), bs58.decode(tx.pub));
  } catch { return false; }
}

// 🧠 Application TX
function applyTx(tx) {
  const w = wallets[tx.from];
  if (!w || tx.nonce !== w.nonce + 1) return false;

  switch (tx.type) {
    case "transfer":
      if (w[tx.token] < tx.amount) return false;
      w[tx.token] -= tx.amount;
      wallets[tx.to][tx.token] += tx.amount;
      break;

    case "lp_add":
      if (w.pow < tx.pow || w.usdc < tx.usdc) return false;
      w.pow -= tx.pow;
      w.usdc -= tx.usdc;
      lpPOW += tx.pow;
      lpUSDC += tx.usdc;
      break;

    case "lp_remove":
      if (tx.amount <= 0) return false;
      const powBack = Math.floor(lpPOW * (tx.amount / (lpPOW + lpUSDC)));
      const usdcBack = Math.floor(lpUSDC * (tx.amount / (lpPOW + lpUSDC)));
      lpPOW -= powBack;
      lpUSDC -= usdcBack;
      w.pow += powBack;
      w.usdc += usdcBack;
      break;

    case "bridge_sol_in":
      treasury.usdc += tx.usdc;
      w.pow += tx.pow;
      supplyPOW -= tx.pow;
      break;

    case "stake":
      if (w.pow < tx.amount) return false;
      w.pow -= tx.amount;
      w.staked += tx.amount;
      break;

    case "unstake":
      if (w.staked < tx.amount) return false;
      w.staked -= tx.amount;
      w.pow += tx.amount;
      break;

    default:
      return false;
  }

  w.nonce++;
  return true;
}

// 🔥 Production bloc
function mineBlock() {
  if (mempool.length === 0) return;
  let block = { height, txs: mempool.splice(0) };
  block.txs.forEach(applyTx);
  chain.push(block);
  height++;
}

// 🕓 Auto-mine toutes les secondes
setInterval(mineBlock, 1000);

// 🌐 HTTP API
const app = express();
app.use(express.json());

app.get("/stats", (req, res) => {
  res.json({ height, supplyPOW, lpPOW, lpUSDC });
});

app.post("/tx", (req, res) => {
  const tx = req.body;
  if (!tx || !tx.from || !tx.token || !tx.amount) return res.json({ ok: false });

  if (!verifyTx(tx)) return res.json({ ok: false, error: "bad_sig" });

  mempool.push(tx);
  res.json({ ok: true });
});

const server = http.createServer(app);
server.listen(PORT, () => console.log("HTTP API online", PORT));

// 🔌 WebSocket
const wss = new WebSocket.Server({ port: WSPORT });
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "welcome", height }));
});
console.log("WS online", WSPORT);