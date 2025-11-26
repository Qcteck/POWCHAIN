// POWCHAIN validator + API + WS simple (PoS + LP + swap + explorer)
const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const { TextEncoder } = require("util");

const PORT = 3000;
const BLOCK_INTERVAL_MS = 5000;
const BLOCK_REWARD_POW = 10;
const LP_FEE_BPS = 20;
const TREASURY_ADDR = "TREASURY_POWCHAIN";

let chain = [];
let mempool = [];
let wallets = new Map();
let totalSupplyPow = 0;
let lpPool = { pow: 10000, usdc: 10000, price: 1.0 };

// ---------- util wallets / validators ----------
function ensureWallet(addr) {
  if (!wallets.has(addr)) {
    wallets.set(addr, { pow: 0, usdc: 0, lp: 0, staked: 0, nonce: 0, blocks: 0 });
  }
  return wallets.get(addr);
}

function getValidators() {
  const res = [];
  for (const [pub, w] of wallets.entries()) {
    if (w.staked > 0) res.push({ pub, stake: w.staked, blocks: w.blocks });
  }
  return res;
}

// ---------- genesis ----------
function createGenesis() {
  const t = ensureWallet(TREASURY_ADDR);
  t.pow = 1_000_000;
  totalSupplyPow = t.pow;

  lpPool.pow = 100_000;
  lpPool.usdc = 100_000;
  lpPool.price = lpPool.usdc / lpPool.pow;

  const g = {
    height: 0,
    prevHash: "0".repeat(64),
    hash: "GENESIS",
    timestamp: Date.now(),
    nonce: 0,
    producer: TREASURY_ADDR,
    transactions: []
  };
  chain.push(g);
}

createGenesis();

// ---------- HTTP API ----------
const server = http.createServer((req, res) => {
  if (req.url === "/stats") {
    const last = chain[chain.length - 1];
    const validators = getValidators();
    const data = {
      height: last.height,
      blockHash: last.hash,
      timestamp: last.timestamp,
      totalSupplyPow,
      lpPow: lpPool.pow,
      lpUsdc: lpPool.usdc,
      pricePow: lpPool.price,
      wallets: wallets.size,
      validators: validators.length,
      mempool: mempool.length
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("POWCHAIN validator + API en ligne sur port " + PORT);
});

// ---------- WebSocket ----------
const wss = new WebSocket.Server({ server, path: "/ws" });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "info", msg: "Bienvenue sur POWCHAIN" }));
  ws.on("message", (raw) => {
    let j;
    try {
      j = JSON.parse(raw.toString());
    } catch (e) {
      ws.send(JSON.stringify({ type: "info", msg: "Message non JSON" }));
      return;
    }
    handleMessage(ws, j);
  });
});

// ---------- vérif signature ----------
function verifySignature(tx) {
  try {
    if (!tx.sig || !tx.pub) return false;
    const pubKeyBytes = bs58.decode(tx.pub);
    const sigBytes = bs58.decode(tx.sig);
    const msg = new TextEncoder().encode(
      JSON.stringify({
        type: tx.type,
        from: tx.from,
        to: tx.to ?? null,
        amount: tx.amount ?? null,
        token: tx.token ?? null,
        nonce: tx.nonce
      })
    );
    return nacl.sign.detached.verify(msg, sigBytes, pubKeyBytes);
  } catch (e) {
    return false;
  }
}

// ---------- application de TX ----------
function applyTx(tx) {
  const w = ensureWallet(tx.from);

  switch (tx.type) {
    case "transfer": {
      if (!tx.to || typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (w.pow < tx.amount) return false;
      const toW = ensureWallet(tx.to);
      w.pow -= tx.amount;
      toW.pow += tx.amount;
      return true;
    }
    case "stake": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (w.pow < tx.amount) return false;
      w.pow -= tx.amount;
      w.staked += tx.amount;
      return true;
    }
    case "unstake": {
      if (w.staked <= 0) return false;
      w.pow += w.staked;
      w.staked = 0;
      return true;
    }
    case "addLP": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (w.pow < tx.amount) return false;
      const treasury = ensureWallet(TREASURY_ADDR);
      const powIn = tx.amount;
      const usdcIn = powIn * lpPool.price;
      if (treasury.usdc < usdcIn) return false;
      w.pow -= powIn;
      treasury.usdc -= usdcIn;
      lpPool.pow += powIn;
      lpPool.usdc += usdcIn;
      const lpShares = powIn;
      w.lp += lpShares;
      lpPool.price = lpPool.usdc / lpPool.pow;
      return true;
    }
    case "removeLP": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (w.lp < tx.amount) return false;
      const lpShares = tx.amount;
      const powOut = (lpShares / (lpPool.pow + lpShares)) * lpPool.pow;
      const usdcOut = (lpShares / (lpPool.usdc + lpShares)) * lpPool.usdc;
      if (lpPool.pow < powOut || lpPool.usdc < usdcOut) return false;
      w.lp -= lpShares;
      lpPool.pow -= powOut;
      lpPool.usdc -= usdcOut;
      w.pow += powOut;
      w.usdc = (w.usdc || 0) + usdcOut;
      lpPool.price = lpPool.usdc / lpPool.pow;
      return true;
    }
    case "powToUsdc": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (w.pow < tx.amount) return false;
      const amountIn = tx.amount;
      const powRes = lpPool.pow;
      const usdcRes = lpPool.usdc;
      const amountInAfterFee = amountIn * (1 - LP_FEE_BPS / 10000);
      const k = powRes * usdcRes;
      const newPowRes = powRes + amountInAfterFee;
      const newUsdcRes = k / newPowRes;
      const usdcOut = usdcRes - newUsdcRes;
      if (usdcOut <= 0) return false;

      w.pow -= amountIn;
      w.usdc = (w.usdc || 0) + usdcOut;
      lpPool.pow = newPowRes;
      lpPool.usdc = newUsdcRes;
      lpPool.price = lpPool.usdc / lpPool.pow;

      const fee = amountIn - amountInAfterFee;
      const treasury = ensureWallet(TREASURY_ADDR);
      treasury.pow += fee;
      return true;
    }
    case "usdcToPow": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if ((w.usdc || 0) < tx.amount) return false;
      const amountIn = tx.amount;
      const powRes = lpPool.pow;
      const usdcRes = lpPool.usdc;
      const amountInAfterFee = amountIn * (1 - LP_FEE_BPS / 10000);
      const k = powRes * usdcRes;
      const newUsdcRes = usdcRes + amountInAfterFee;
      const newPowRes = k / newUsdcRes;
      const powOut = powRes - newPowRes;
      if (powOut <= 0) return false;

      w.usdc -= amountIn;
      w.pow += powOut;
      lpPool.usdc = newUsdcRes;
      lpPool.pow = newPowRes;
      lpPool.price = lpPool.usdc / lpPool.pow;

      const fee = amountIn - amountInAfterFee;
      const treasury = ensureWallet(TREASURY_ADDR);
      treasury.usdc = (treasury.usdc || 0) + fee;
      return true;
    }
    default:
      return false;
  }
}

// ---------- state / explorer ----------
function buildWalletState(addr) {
  const w = ensureWallet(addr);
  return {
    pow: w.pow,
    usdc: w.usdc || 0,
    lp: w.lp,
    staked: w.staked,
    nonce: w.nonce
  };
}

function sendState(ws, addr) {
  ws.send(JSON.stringify({ type: "state", wallet: buildWalletState(addr) }));
}

function buildExplorer() {
  const last = chain[chain.length - 1];
  return {
    height: last.height,
    blockHash: last.hash,
    timestamp: last.timestamp,
    nonce: last.nonce,
    producer: last.producer,
    transactions: last.transactions || [],
    mempool,
    validators: getValidators(),
    supplyPow: totalSupplyPow,
    supplyLpPow: lpPool.pow,
    pricePow: lpPool.price
  };
}

function sendExplorer(ws) {
  ws.send(JSON.stringify({ type: "explorer", data: buildExplorer() }));
}

// ---------- message handler ----------
function handleMessage(ws, j) {
  if (j.type === "requestState" && j.pub) {
    sendState(ws, j.pub);
    return;
  }
  if (j.type === "explorer") {
    sendExplorer(ws);
    return;
  }

  if (
    j.type === "transfer" ||
    j.type === "stake" ||
    j.type === "unstake" ||
    j.type === "addLP" ||
    j.type === "removeLP" ||
    j.type === "powToUsdc" ||
    j.type === "usdcToPow"
  ) {
    validateAndQueueTx(ws, j);
    return;
  }

  ws.send(JSON.stringify({ type: "info", msg: "Type inconnu: " + j.type }));
}

function validateAndQueueTx(ws, tx) {
  if (!tx.type || !tx.from || !tx.pub || typeof tx.nonce !== "number") {
    ws.send(JSON.stringify({ type: "info", msg: "TX invalide (champs manquants)" }));
    return;
  }
  if (tx.from !== tx.pub) {
    ws.send(JSON.stringify({ type: "info", msg: "TX rejetée: from != pub" }));
    return;
  }
  if (!verifySignature(tx)) {
    ws.send(JSON.stringify({ type: "info", msg: "Signature invalide" }));
    return;
  }
  const w = ensureWallet(tx.from);
  if (tx.nonce <= w.nonce) {
    ws.send(JSON.stringify({ type: "info", msg: "Nonce invalide (replay?)" }));
    return;
  }
  const ok = applyTx(tx);
  if (!ok) {
    ws.send(JSON.stringify({ type: "info", msg: "TX rejetée (fonds ou type)" }));
    return;
  }
  w.nonce = tx.nonce;
  mempool.push(tx);
  ws.send(JSON.stringify({ type: "info", msg: "TX acceptée en mempool" }));
  sendState(ws, tx.from);
}

// ---------- production de blocs ----------
function chooseValidator() {
  const validators = getValidators();
  if (validators.length === 0) return TREASURY_ADDR;
  let totalStake = 0;
  for (const v of validators) totalStake += v.stake;
  if (totalStake <= 0) return TREASURY_ADDR;
  let r = Math.random() * totalStake;
  for (const v of validators) {
    if (r < v.stake) return v.pub;
    r -= v.stake;
  }
  return validators[validators.length - 1].pub;
}

function produceBlock() {
  const last = chain[chain.length - 1];
  const producer = chooseValidator();
  const producerWallet = ensureWallet(producer);
  const txs = mempool.slice();
  mempool = [];

  const height = last.height + 1;
  const timestamp = Date.now();
  const nonce = Math.floor(Math.random() * 1e9);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ height, prevHash: last.hash, timestamp, nonce, txs }))
    .digest("hex");

  const block = { height, prevHash: last.hash, hash, timestamp, nonce, producer, transactions: txs };
  chain.push(block);

  producerWallet.pow += BLOCK_REWARD_POW;
  producerWallet.blocks += 1;
  totalSupplyPow += BLOCK_REWARD_POW;
  lpPool.price = lpPool.pow > 0 ? lpPool.usdc / lpPool.pow : lpPool.price;

  broadcast({ type: "info", msg: "Nouveau bloc " + height + " par " + producer });
  broadcast({ type: "explorer", data: buildExplorer() });
}

setInterval(produceBlock, BLOCK_INTERVAL_MS);

// ---------- lancement ----------
server.listen(PORT, () => {
  console.log("POWCHAIN validator + API en ligne sur port", PORT);
});