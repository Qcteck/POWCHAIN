const http = require("http");
const express = require("express");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = 3000;

const DEC = 1e6;
const TREASURY_ADDR = "TREASURY_POWCHAIN";

const state = {
  height: 1,
  lpPow: 0,
  lpUsdc: 0,
  treasuryUsdc: 0,
  treasurySol: 0,
  wallets: {},
  blocks: [],
  mempool: []
};

function getWallet(addr) {
  if (!state.wallets[addr]) {
    state.wallets[addr] = { pow: 0, usdc: 0, staked: 0, nonce: 0, pub: addr };
  }
  return state.wallets[addr];
}

function applyTx(tx) {
  const type = tx.type;

  if (type === "TX_POW") {
    const from = getWallet(tx.from);
    const to = getWallet(tx.to);
    const amt = Number(tx.amount || 0);
    if (amt <= 0) return;
    if (from.pow < amt) return;
    from.pow -= amt;
    to.pow += amt;
  }

  if (type === "STAKE") {
    const w = getWallet(tx.addr || tx.from);
    const amt = Number(tx.amount || 0);
    if (amt <= 0) return;
    if (w.pow < amt) return;
    w.pow -= amt;
    w.staked += amt;
  }

  if (type === "SWAP") {
    const w = getWallet(tx.addr || tx.from);
    const amt = Number(tx.amount || 0);
    if (amt <= 0) return;
    if (state.lpPow <= 0 || state.lpUsdc <= 0) return;

    const token = tx.token;

    if (token === "pow2usdc") {
      if (w.pow < amt) return;
      const k = state.lpPow * state.lpUsdc;
      const newLpPow = state.lpPow + amt;
      const newLpUsdc = Math.floor(k / newLpPow);
      const outUsdc = state.lpUsdc - newLpUsdc;
      if (outUsdc <= 0) return;
      w.pow -= amt;
      w.usdc += outUsdc;
      state.lpPow = newLpPow;
      state.lpUsdc = newLpUsdc;
    }

    if (token === "usdc2pow") {
      if (w.usdc < amt) return;
      const k = state.lpPow * state.lpUsdc;
      const newLpUsdc = state.lpUsdc + amt;
      const newLpPow = Math.floor(k / newLpUsdc);
      const outPow = state.lpPow - newLpPow;
      if (outPow <= 0) return;
      w.usdc -= amt;
      w.pow += outPow;
      state.lpPow = newLpPow;
      state.lpUsdc = newLpUsdc;
    }
  }

  if (type === "LP_ADD") {
    const w = getWallet(tx.addr || tx.from);
    const powAmt = Number(tx.pow || 0);
    const usdcAmt = Number(tx.usdc || 0);
    if (powAmt <= 0 || usdcAmt <= 0) return;
    if (w.pow < powAmt || w.usdc < usdcAmt) return;
    w.pow -= powAmt;
    w.usdc -= usdcAmt;
    state.lpPow += powAmt;
    state.lpUsdc += usdcAmt;
  }

  if (tx.from) {
    const wf = getWallet(tx.from);
    wf.nonce = (wf.nonce || 0) + 1;
  }
}

function buildBlock() {
  if (!state.mempool.length) return null;
  const txs = state.mempool.splice(0, state.mempool.length);
  const height = state.height + 1;
  const time = Date.now();
  const prevHash = state.blocks.length ? state.blocks[state.blocks.length - 1].hash : "GENESIS";
  const content = JSON.stringify({ height, time, prevHash, txs });
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  const validator = TREASURY_ADDR;

  txs.forEach(applyTx);

  const block = { height, time, prevHash, hash, validator, txs };
  state.blocks.push(block);
  state.height = height;
  return block;
}

function startMiner(broadcast) {
  setInterval(() => {
    const block = buildBlock();
    if (block && broadcast) {
      broadcast(JSON.stringify({ type: "BLOCK", block }));
    }
  }, 5000);
}

function seedInitialState() {
  const t = getWallet(TREASURY_ADDR);
  const basePow = 1000000 * DEC;
  const baseUsdc = 100000 * DEC;
  t.pow = basePow;
  t.usdc = baseUsdc;
  state.treasuryUsdc = baseUsdc;
  state.treasurySol = 0;
  state.lpPow = 100000 * DEC;
  state.lpUsdc = 10000 * DEC;
  state.blocks.push({
    height: 1,
    time: Date.now(),
    prevHash: "GENESIS",
    hash: crypto.createHash("sha256").update("GENESIS").digest("hex"),
    validator: TREASURY_ADDR,
    txs: []
  });
  state.height = 1;
}

seedInitialState();

const app = express();
app.use(express.json());

app.get("/powchain/stats", (req, res) => {
  res.json({
    height: state.height,
    lpPow: state.lpPow,
    lpUsdc: state.lpUsdc,
    treasuryUsdc: state.treasuryUsdc,
    treasurySol: state.treasurySol
  });
});

app.get("/powchain/wallet/:addr", (req, res) => {
  const addr = req.params.addr;
  const w = getWallet(addr);
  res.json({
    pow: w.pow,
    usdc: w.usdc,
    staked: w.staked,
    nonce: w.nonce || 0,
    pub: w.pub || addr
  });
});

app.get("/powchain/block/:height", (req, res) => {
  const h = parseInt(req.params.height, 10);
  const block = state.blocks.find(b => b.height === h);
  if (!block) {
    return res.status(404).json({ error: "block not found" });
  }
  res.json({
    hash: block.hash,
    validator: block.validator,
    time: block.time,
    txs: block.txs
  });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/powchain/ws" });

function broadcast(msg) {
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "HELLO", height: state.height }));
  ws.on("message", data => {
    try {
      const tx = JSON.parse(data.toString());
      if (!tx.type) return;
      state.mempool.push(tx);
      ws.send(JSON.stringify({ type: "ACCEPTED", nonce: tx.nonce || null }));
    } catch (e) {
      ws.send(JSON.stringify({ type: "ERROR", msg: "invalid tx" }));
    }
  });
});

server.listen(PORT, () => {
  console.log("POWCHAIN server listening on port", PORT);
});

startMiner(broadcast);