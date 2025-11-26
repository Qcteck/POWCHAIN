// server.js — POWCHAIN PRO (PoS + LP + Explorer + Graph)

// Dépendances
const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

// ----------------- CONFIG DE BASE -----------------
const PORT = 3000;
const BLOCK_INTERVAL_MS = 5000;      // production d'un bloc toutes les 5s
const BLOCK_REWARD_POW = 10;         // récompense par bloc
const LP_FEE_BPS = 20;               // 0.20% de frais pour les swaps
const TREASURY_ADDR = "TREASURY_POWCHAIN";

// ----------------- ÉTAT GLOBAL -----------------
let chain = [];
let mempool = [];
let wallets = new Map(); // addr -> {pow, usdc, lp, staked, nonce, blocks}
let totalSupplyPow = 0;

// LP pool POW / USDC POW (x*y=k)
let lpPool = {
  pow: 10000,
  usdc: 10000,
  price: 1.0 // 1 USDC par POW au départ
};

// --- Helpers wallets ---
function ensureWallet(addr) {
  if (!wallets.has(addr)) {
    wallets.set(addr, { pow: 0, usdc: 0, lp: 0, staked: 0, nonce: 0, blocks: 0 });
  }
  return wallets.get(addr);
}

function getValidatorList() {
  const res = [];
  for (const [pub, w] of wallets.entries()) {
    if (w.staked > 0) {
      res.push({ pub, stake: w.staked, blocks: w.blocks });
    }
  }
  return res;
}

// ----------------- GENESIS -----------------
function createGenesis() {
  // Générer la trésorerie avec un supply initial
  const treasury = ensureWallet(TREASURY_ADDR);
  treasury.pow = 1_000_000;
  totalSupplyPow = treasury.pow;
  lpPool.pow = 100_000;
  lpPool.usdc = 100_000;
  lpPool.price = lpPool.usdc / lpPool.pow;

  const genesisBlock = {
    height: 0,
    prevHash: "0".repeat(64),
    hash: "GENESIS",
    timestamp: Date.now(),
    nonce: 0,
    producer: TREASURY_ADDR,
    transactions: []
  };
  chain.push(genesisBlock);
}

createGenesis();

// ----------------- HTTP SERVER -----------------
const server = http.createServer((req, res) => {
  if (req.url === "/stats") {
    const lastBlock = chain[chain.length - 1];
    const validators = getValidatorList();
    const stats = {
      height: lastBlock.height,
      blockHash: lastBlock.hash,
      timestamp: lastBlock.timestamp,
      totalSupplyPow,
      lpPow: lpPool.pow,
      lpUsdc: lpPool.usdc,
      pricePow: lpPool.price,
      wallets: wallets.size,
      validators: validators.length,
      mempool: mempool.length
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("POWCHAIN validator + API en ligne sur port " + PORT);
});

// ----------------- WEBSOCKET SERVER -----------------
const wss = new WebSocket.Server({ server, path: "/ws" });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
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

// ----------------- SIGNATURE / VALIDATION TX -----------------
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

  // Appliquer la TX immédiatement + mettre en mempool
  const ok = applyTx(tx);
  if (!ok) {
    ws.send(JSON.stringify({ type: "info", msg: "TX rejetée (fonds insuffisants ou type inconnu)" }));
    return;
  }

  w.nonce = tx.nonce;
  mempool.push(tx);
  ws.send(JSON.stringify({ type: "info", msg: "TX acceptée en mempool" }));
  // envoyer état mis à jour du wallet
  sendStateFor(ws, tx.from);
}

// ----------------- APPLICATION DES TX -----------------
function applyTx(tx) {
  const fromW = ensureWallet(tx.from);

  switch (tx.type) {
    case "transfer": {
      if (!tx.to || typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (fromW.pow < tx.amount) return false;
      const toW = ensureWallet(tx.to);
      fromW.pow -= tx.amount;
      toW.pow += tx.amount;
      return true;
    }

    case "stake": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (fromW.pow < tx.amount) return false;
      fromW.pow -= tx.amount;
      fromW.staked += tx.amount;
      return true;
    }

    case "unstake": {
      // pour la simplicité, on laisse libérer tout le staked
      if (fromW.staked <= 0) return false;
      fromW.pow += fromW.staked;
      fromW.staked = 0;
      return true;
    }

    case "addLP": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (fromW.pow < tx.amount) return false;
      // ajoute du POW dans le pool, USDC vient du trésor (simple)
      const treasury = ensureWallet(TREASURY_ADDR);
      const powIn = tx.amount;
      const usdcIn = tx.amount * lpPool.price; // approx, 1:price

      if (treasury.usdc < usdcIn) return false;

      fromW.pow -= powIn;
      treasury.usdc -= usdcIn;

      lpPool.pow += powIn;
      lpPool.usdc += usdcIn;

      const lpShares = powIn; // simple: 1 LP = 1 POW déposé
      fromW.lp += lpShares;

      lpPool.price = lpPool.usdc / lpPool.pow;

      return true;
    }

    case "removeLP": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      if (fromW.lp < tx.amount) return false;

      const lpShares = tx.amount;
      const powOut = (lpShares / (lpPool.pow + lpShares)) * lpPool.pow; // simple proportion
      const usdcOut = (lpShares / (lpPool.usdc + lpShares)) * lpPool.usdc;

      fromW.lp -= lpShares;
      if (lpPool.pow < powOut || lpPool.usdc < usdcOut) return false;

      lpPool.pow -= powOut;
      lpPool.usdc -= usdcOut;

      fromW.pow += powOut;
      fromW.usdc += usdcOut;

      lpPool.price = lpPool.usdc / lpPool.pow;

      return true;
    }

    case "powToUsdc": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      const amountIn = tx.amount;
      if (fromW.pow < amountIn) return false;

      // AMM x*y = k
      const powRes = lpPool.pow;
      const usdcRes = lpPool.usdc;
      const amountInAfterFee = amountIn * (1 - LP_FEE_BPS / 10000);
      const k = powRes * usdcRes;
      const newPowRes = powRes + amountInAfterFee;
      const newUsdcRes = k / newPowRes;
      const usdcOut = usdcRes - newUsdcRes;

      if (usdcOut <= 0) return false;

      fromW.pow -= amountIn;
      fromW.usdc += usdcOut;

      lpPool.pow = newPowRes;
      lpPool.usdc = newUsdcRes;
      lpPool.price = lpPool.usdc / lpPool.pow;

      // Fee vers trésorerie
      const fee = amountIn - amountInAfterFee;
      const treasury = ensureWallet(TREASURY_ADDR);
      treasury.pow += fee;

      totalSupplyPow += 0; // pas de mint ici
      return true;
    }

    case "usdcToPow": {
      if (typeof tx.amount !== "number" || tx.amount <= 0) return false;
      const amountIn = tx.amount;
      if (fromW.usdc < amountIn) return false;

      const powRes = lpPool.pow;
      const usdcRes = lpPool.usdc;
      const amountInAfterFee = amountIn * (1 - LP_FEE_BPS / 10000);
      const k = powRes * usdcRes;
      const newUsdcRes = usdcRes + amountInAfterFee;
      const newPowRes = k / newUsdcRes;
      const powOut = powRes - newPowRes;

      if (powOut <= 0) return false;

      fromW.usdc -= amountIn;
      fromW.pow += powOut;

      lpPool.usdc = newUsdcRes;
      lpPool.pow = newPowRes;
      lpPool.price = lpPool.usdc / lpPool.pow;

      const fee = amountIn - amountInAfterFee;
      const treasury = ensureWallet(TREASURY_ADDR);
      treasury.usdc += fee;

      return true;
    }

    default:
      return false;
  }
}

// ----------------- ÉTAT WALLET → CLIENT -----------------
function buildWalletState(addr) {
  const w = ensureWallet(addr);
  return {
    pow: w.pow,
    usdc: w.usdc,
    lp: w.lp,
    staked: w.staked,
    nonce: w.nonce
  };
}

function sendStateFor(ws, addr) {
  const state = buildWalletState(addr);
  ws.send(JSON.stringify({ type: "state", wallet: state }));
}

// ----------------- EXPLORER DATA -----------------
function buildExplorerData() {
  const lastBlock = chain[chain.length - 1];
  const validators = getValidatorList();
  return {
    height: lastBlock.height,
    blockHash: lastBlock.hash,
    timestamp: lastBlock.timestamp,
    nonce: lastBlock.nonce,
    producer: lastBlock.producer,
    mempool: mempool,
    transactions: lastBlock.transactions || [],
    validators: validators,
    supplyPow: totalSupplyPow,
    supplyLpPow: lpPool.pow,
    pricePow: lpPool.price
  };
}

function sendExplorer(ws) {
  const data = buildExplorerData();
  ws.send(JSON.stringify({ type: "explorer", data }));
}

// ----------------- GESTION DES MESSAGES WS -----------------
function handleMessage(ws, j) {
  if (j.type === "requestState" && j.pub) {
    sendStateFor(ws, j.pub);
    return;
  }

  if (j.type === "explorer") {
    sendExplorer(ws);
    return;
  }

  // TX signées (transfer, stake, addLP, etc.)
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

// ----------------- PRODUCTION DE BLOCS (PoS) -----------------
function chooseValidator() {
  const validators = getValidatorList();
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
  const producerAddr = chooseValidator();
  const producerWallet = ensureWallet(producerAddr);

  const txs = mempool.slice();
  mempool = [];

  const height = last.height + 1;
  const timestamp = Date.now();
  const nonce = Math.floor(Math.random() * 1e9);

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ height, prevHash: last.hash, timestamp, nonce, txs }))
    .digest("hex");

  const block = {
    height,
    prevHash: last.hash,
    hash,
    timestamp,
    nonce,
    producer: producerAddr,
    transactions: txs
  };

  chain.push(block);

  // Récompense de bloc
  producerWallet.pow += BLOCK_REWARD_POW;
  producerWallet.blocks += 1;
  totalSupplyPow += BLOCK_REWARD_POW;

  lpPool.price = lpPool.pow > 0 ? lpPool.usdc / lpPool.pow : lpPool.price;

  broadcast({ type: "info", msg: "Nouveau bloc " + height + " par " + producerAddr });
  // On peut aussi pousser l'explorer
  const ex = buildExplorerData();
  broadcast({ type: "explorer", data: ex });
}

// Lancer le timer de production de blocs
setInterval(produceBlock, BLOCK_INTERVAL_MS);

// ----------------- LANCEMENT SERVEUR -----------------
server.listen(PORT, () => {
  console.log("POWCHAIN validator + API en ligne sur port", PORT);
});