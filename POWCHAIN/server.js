// POWCHAIN v4 – Validator + API + WS + DEX + Bridge SOL
// Fichier : server.js

import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import crypto from "crypto";
import nacl from "tweetnacl";
import bs58 from "bs58";
import express from "express";
import cors from "cors";
import { Level } from "level";

const PORT_WS  = process.env.WS  || 7001;
const PORT_API = process.env.API || 3000;
const PEERS    = (process.env.PEERS || "").split(",").filter(Boolean);

const DEC          = 1e6;
const USDC_PER_SOL = 100e6;     // capacité max USDC par SOL dans la trésorerie
const BLOCK_REWARD = 10 * DEC;

// ---------- DB (Level) ----------
const dbState   = new Level("./db/state",   { valueEncoding: "json" });
const dbWallets = new Level("./db/wallets", { valueEncoding: "json" });
const dbChain   = new Level("./db/chain",   { valueEncoding: "json" });

let mempool = [];
let lpPow = 0, lpUsdc = 0, treasurySol = 0, treasuryUsdc = 0;
let height = 0;

// ---------- Utils ----------
async function w(addr) {
  try {
    return await dbWallets.get(addr);
  } catch (e) {
    if (e && e.code === "LEVEL_NOT_FOUND") {
      const nw = { pow: 0, usdc: 0, staked: 0, pub: null, nonce: 0 };
      await dbWallets.put(addr, nw);
      return nw;
    }
    throw e;
  }
}

const hash = o =>
  crypto.createHash("sha256").update(JSON.stringify(o)).digest("hex");

const log = (...x) => console.log("[POWCHAIN]", ...x);

// ---------- Signature ----------
async function verifySig(tx) {
  const acc = await w(tx.from);
  if (!acc.pub && tx.pub) {
    acc.pub = tx.pub;
    await dbWallets.put(tx.from, acc);
  }
  if (!acc.pub) return false;

  const m = JSON.stringify({
    type: tx.type,
    from: tx.from,
    to: tx.to ?? null,
    amount: tx.amount ?? null,
    token: tx.token ?? null,
    nonce: tx.nonce
  });

  const msg = new TextEncoder().encode(m);
  return nacl.sign.detached.verify(
    msg,
    bs58.decode(tx.sig),
    bs58.decode(acc.pub)
  );
}

// ---------- Validator PoS ----------
async function chooseValidator() {
  let sum = 0;
  for await (const [, v] of dbWallets.iterator()) {
    sum += v.staked || 0;
  }
  if (!sum) return null;
  let r = Math.random() * sum;
  for await (const [a, v] of dbWallets.iterator()) {
    r -= v.staked || 0;
    if (r <= 0) return a;
  }
  return null;
}

// ---------- P2P ----------
let sockets = [];

function broadcast(x) {
  const s = JSON.stringify(x);
  sockets.forEach(ws => ws.readyState === 1 && ws.send(s));
}

function connectPeer(url) {
  const ws = new WebSocket(url);
  ws.on("open", () => {
    sockets.push(ws);
    ws.send(JSON.stringify({ type: "STATE_REQUEST" }));
    log("Peer connecté", url);
  });
  ws.on("message", m => onMsg(ws, m));
  ws.on("close", () => {
    sockets = sockets.filter(x => x !== ws);
    log("Peer fermé", url);
    setTimeout(() => connectPeer(url), 2000);
  });
}
PEERS.forEach(connectPeer);

// ---------- Message handler ----------
async function onMsg(ws, msg) {
  try {
    const d = typeof msg === "string" ? JSON.parse(msg) : JSON.parse(msg.toString());

    if (d.type === "STATE_REQUEST") {
      return ws.send(JSON.stringify({ type: "STATE_SHORT", height }));
    }

    // opérations sécurisées (signature + nonce)
    const secured = ["TX_POW", "SEND_USDC", "LP_ADD", "SWAP", "STAKE", "BRIDGE_SOL"];
    if (secured.includes(d.type)) {
      if (!await verifySig(d))
        return ws.send(JSON.stringify({ type: "ERR", msg: "bad signature" }));

      const acc = await w(d.from);
      if (d.nonce !== acc.nonce + 1)
        return ws.send(JSON.stringify({ type: "ERR", msg: "bad nonce" }));

      acc.nonce++;
      await dbWallets.put(d.from, acc);
    }

    // ---- TX_POW → mempool (inclus dans les blocs) ----
    if (d.type === "TX_POW") {
      const acc = await w(d.from);
      if (acc.pow < d.amount)
        return ws.send(JSON.stringify({ type: "ERR", msg: "no pow" }));
      mempool.push(d);
      broadcast({ type: "TX", tx: d });
      return ws.send(JSON.stringify({ type: "TX_OK" }));
    }

    // ---- SEND_USDC direct ----
    if (d.type === "SEND_USDC") {
      const a = await w(d.from), b = await w(d.to);
      if (a.usdc < d.amount)
        return ws.send(JSON.stringify({ type: "ERR", msg: "no usdc" }));
      a.usdc -= d.amount;
      b.usdc += d.amount;
      await dbWallets.put(d.from, a);
      await dbWallets.put(d.to, b);
      return ws.send(JSON.stringify({ type: "SEND_USDC_OK" }));
    }

    // ---- MINT_USDC contre collatéral SOL ----
    if (d.type === "MINT_USDC") {
      const max = treasurySol * USDC_PER_SOL;
      let supply = 0;
      for await (const [, v] of dbWallets.iterator()) supply += v.usdc || 0;
      if (supply + d.amount > max)
        return ws.send(JSON.stringify({ type: "ERR", msg: "no collateral" }));
      const acc = await w(d.addr);
      acc.usdc += d.amount;
      await dbWallets.put(d.addr, acc);
      return ws.send(JSON.stringify({ type: "MINT_OK" }));
    }

    // ---- LP_ADD ----
    if (d.type === "LP_ADD") {
      const acc = await w(d.addr);
      if (acc.pow < d.pow || acc.usdc < d.usdc)
        return ws.send(JSON.stringify({ type: "ERR", msg: "no funds" }));
      acc.pow -= d.pow;
      acc.usdc -= d.usdc;
      lpPow   += d.pow;
      lpUsdc  += d.usdc;
      await dbWallets.put(d.addr, acc);
      return ws.send(JSON.stringify({ type: "LP_OK" }));
    }

    // ---- SWAP x*y=k ----
    if (d.type === "SWAP") {
      const A = await w(d.addr);
      const X = lpPow, Y = lpUsdc;
      const fee = 30; // 0.30%
      if (X <= 0 || Y <= 0)
        return ws.send(JSON.stringify({ type: "ERR", msg: "empty pool" }));

      if (d.token === "pow2usdc") {
        if (A.pow < d.amount)
          return ws.send(JSON.stringify({ type: "ERR", msg: "no pow" }));
        const dxEff = Math.floor(d.amount * (10000 - fee) / 10000);
        const k = X * Y;
        const newX = X + dxEff;
        const newY = Math.floor(k / newX);
        const out = Y - newY;
        if (out <= 0) return ws.send(JSON.stringify({ type: "ERR", msg: "no output" }));
        A.pow  -= d.amount;
        A.usdc += out;
        lpPow  += d.amount;
        lpUsdc -= out;
        treasuryUsdc += d.amount - dxEff;
      } else {
        if (A.usdc < d.amount)
          return ws.send(JSON.stringify({ type: "ERR", msg: "no usdc" }));
        const dyEff = Math.floor(d.amount * (10000 - fee) / 10000);
        const k = X * Y;
        const newY = Y + dyEff;
        const newX = Math.floor(k / newY);
        const out = X - newX;
        if (out <= 0) return ws.send(JSON.stringify({ type: "ERR", msg: "no output" }));
        A.usdc -= d.amount;
        A.pow  += out;
        lpUsdc += d.amount;
        lpPow  -= out;
        treasuryUsdc += d.amount - dyEff;
      }
      await dbWallets.put(d.addr, A);
      return ws.send(JSON.stringify({ type: "SWAP_OK" }));
    }

    // ---- STAKE ----
    if (d.type === "STAKE") {
      const acc = await w(d.addr);
      if (acc.pow < d.amount)
        return ws.send(JSON.stringify({ type: "ERR", msg: "no pow" }));
      acc.pow    -= d.amount;
      acc.staked += d.amount;
      await dbWallets.put(d.addr, acc);
      return ws.send(JSON.stringify({ type: "STAKE_OK" }));
    }

    // ---- BRIDGE_SOL (trésorerie + mint POW) ----
    if (d.type === "BRIDGE_SOL") {
      treasurySol += d.solAmount;
      const acc = await w(d.addr);
      acc.pow += Math.floor(d.solAmount * 10 * DEC); // 10 POW par SOL
      await dbWallets.put(d.addr, acc);
      return ws.send(JSON.stringify({ type: "BRIDGE_OK" }));
    }

    // ---- GET_STATE ----
    if (d.type === "GET_STATE") {
      const a = await w(d.addr);
      return ws.send(JSON.stringify({
        type: "STATE",
        height,
        pow: a.pow,
        usdc: a.usdc,
        staked: a.staked,
        lpPow,
        lpUsdc,
        treasuryUsdc,
        treasurySol,
        nonce: a.nonce,
        pub: a.pub
      }));
    }

  } catch (e) {
    log("ERR onMsg", e);
  }
}

// ---------- Production de blocs ----------
async function produce() {
  if (!mempool.length) return;
  const val = await chooseValidator();
  if (!val) return;

  const prevBlock = height ? await dbChain.get(height) : null;
  const block = {
    height: height + 1,
    prev: prevBlock ? prevBlock.hash : "GENESIS",
    txs: mempool,
    validator: val,
    reward: BLOCK_REWARD,
    time: Date.now()
  };
  block.hash = hash(block);

  const vAcc = await w(val);
  vAcc.pow += BLOCK_REWARD;
  await dbWallets.put(val, vAcc);

  await dbChain.put(block.height, block);
  height = block.height;
  mempool = [];
  broadcast({ type: "NEW_BLOCK", block });
  log("⛏ Bloc", height, "→", val);
}
setInterval(produce, 1800);

// ---------- WS Server ----------
const serverWS = http.createServer();
const wss = new WebSocketServer({ server: serverWS });

wss.on("connection", ws => {
  sockets.push(ws);
  ws.on("message", m => onMsg(ws, m));
  ws.on("close", () => {
    sockets = sockets.filter(x => x !== ws);
  });
});

serverWS.listen(PORT_WS, () => log("WS live →", PORT_WS));

// ---------- API / Explorer ----------
const app = express();
app.use(cors());
app.use(express.static("./public"));   // sert ton index.html HUD

app.get("/stats", async (_, res) => {
  res.json({ height, lpPow, lpUsdc, treasurySol, treasuryUsdc });
});

app.get("/wallet/:a", async (req, res) => {
  const data = await w(req.params.a);
  res.json(data);
});

app.get("/block/:h", async (req, res) => {
  const h = parseInt(req.params.h);
  const b = await dbChain.get(h);
  res.json(b);
});

app.get("/chain", async (_, res) => {
  const out = [];
  for await (const [, b] of dbChain.iterator()) out.push(b);
  res.json(out);
});

app.listen(PORT_API, () => log("API live →", PORT_API));