// POWCHAIN — Validator complet (staking + LP + swap + mempool + auto-block)
// Node.js v18+ requis

const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const WebSocket = require("ws");
const nacl = require("tweetnacl");

const app = express();
app.use(bodyParser.json());
const httpServer = http.createServer(app);
const wss = new WebSocket.Server({ server: httpServer, path: "/ws" });

const DEC = 1e6;

// ===== Base58 maison (alphabet Bitcoin) =====
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58enc(buf) {
  const bytes = Array.from(buf);
  if (!bytes.length) return "";
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let k = 0; bytes[k] === 0 && k < bytes.length; k++) out += "1";
  for (let q = digits.length - 1; q >= 0; q--) out += B58[digits[q]];
  return out;
}

function b58dec(str) {
  if (!str || typeof str !== "string") throw new Error("invalid base58");
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const v = B58.indexOf(str[i]);
    if (v < 0) throw new Error("invalid base58 char");
    let carry = v;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; str[k] === "1" && k < str.length; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

// ===== État POWCHAIN =====

// Chaîne de blocs : [{height,time,prev,hash,txs,validator}]
const chain = [];

// Mempool : txs en attente
const mempool = [];

// Wallets: addr -> {pow,usdc,staked,nonce,pub}
const wallets = Object.create(null);

// LP interne x*y = k (POW/USDC POW)
const lp = { pow: 0, usdc: 0 };

// Trésorerie officielle POWCHAIN (adresse fournie par toi)
const TREASURY_ADDR = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

wallets[TREASURY_ADDR] = {
  pow: 0,
  usdc: 0,
  staked: 0,
  nonce: 0,
  pub: null
};

// ===== Utilitaires =====

function log(...args) {
  console.log(new Date().toISOString(), "-", ...args);
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(data);
  });
}

function ensureWallet(addr, pub) {
  if (!addr || typeof addr !== "string") throw new Error("ADDR_EMPTY");
  let w = wallets[addr];
  if (!w) {
    w = wallets[addr] = { pow: 0, usdc: 0, staked: 0, nonce: 0, pub: null };
  }
  if (pub) {
    if (w.pub && w.pub !== pub) throw new Error("PUB_MISMATCH");
    if (!w.pub) w.pub = pub;
  }
  return w;
}

function chainHeight() {
  return chain.length ? chain[chain.length - 1].height : 0;
}

function getSupply() {
  let supplyPow = 0, supplyUsdc = 0;
  for (const a of Object.keys(wallets)) {
    const w = wallets[a];
    supplyPow += (w.pow + w.staked);
    supplyUsdc += w.usdc;
  }
  return { pow: supplyPow, usdc: supplyUsdc };
}

// ===== Vérification de signatures & tx =====

function buildMsg(tx) {
  return Buffer.from(
    JSON.stringify({
      type: tx.type,
      from: tx.from,
      to: tx.to ?? null,
      amount: tx.amount ?? 0,
      token: tx.token ?? null,
      nonce: tx.nonce
    })
  );
}

function verifySig(tx) {
  try {
    if (!tx.sig || !tx.pub) return false;
    const msg = buildMsg(tx);
    const sig = b58dec(tx.sig);
    const pub = b58dec(tx.pub);
    return nacl.sign.detached.verify(msg, sig, pub);
  } catch (e) {
    return false;
  }
}

function validateTxBasic(tx) {
  if (!tx || typeof tx !== "object") return "TX_EMPTY";
  if (typeof tx.type !== "string") return "TYPE";
  if (typeof tx.from !== "string") return "FROM";
  if (typeof tx.nonce !== "number") return "NONCE";
  if (typeof tx.amount !== "number" || tx.amount <= 0) return "AMOUNT";
  if (!["POW", "USDC"].includes(tx.token || "POW")) return "TOKEN";
  return null;
}

// ===== Application des tx sur l'état =====

function applyTx(tx) {
  const basicErr = validateTxBasic(tx);
  if (basicErr) throw new Error("BAD_" + basicErr);

  const wFrom = ensureWallet(tx.from, tx.pub);
  if (tx.nonce !== wFrom.nonce + 1) throw new Error("BAD_NONCE");
  if (!verifySig(tx)) throw new Error("BAD_SIG");

  const amt = Math.floor(tx.amount);

  switch (tx.type) {
    case "transfer": {
      const wTo = ensureWallet(tx.to);
      if (tx.token === "POW") {
        if (wFrom.pow < amt) throw new Error("NO_FUNDS");
        wFrom.pow -= amt;
        wTo.pow += amt;
      } else {
        if (wFrom.usdc < amt) throw new Error("NO_FUNDS");
        wFrom.usdc -= amt;
        wTo.usdc += amt;
      }
      break;
    }

    case "stake": {
      if (tx.token !== "POW") throw new Error("STAKE_POW_ONLY");
      if (wFrom.pow < amt) throw new Error("NO_FUNDS");
      wFrom.pow -= amt;
      wFrom.staked += amt;
      break;
    }

    case "unstake": {
      if (tx.token !== "POW") throw new Error("UNSTAKE_POW_ONLY");
      if (wFrom.staked < amt) throw new Error("NO_STAKED");
      wFrom.staked -= amt;
      wFrom.pow += amt;
      break;
    }

    case "lp_add": {
      // ajoute de la liquidité POW + USDC dans les mêmes proportions que le pool
      const half = amt; // on suppose amt = POW, user envoie aussi amt en USDC
      if (wFrom.pow < half || wFrom.usdc < half) throw new Error("NO_FUNDS");
      wFrom.pow -= half;
      wFrom.usdc -= half;
      lp.pow += half;
      lp.usdc += half;
      break;
    }

    case "lp_remove": {
      // retire une partie proportionnelle du pool
      if (lp.pow === 0 || lp.usdc === 0) throw new Error("POOL_EMPTY");
      const share = amt / (lp.pow + lp.usdc); // simplifié
      const outPow = Math.floor(lp.pow * share);
      const outUsdc = Math.floor(lp.usdc * share);
      lp.pow -= outPow;
      lp.usdc -= outUsdc;
      wFrom.pow += outPow;
      wFrom.usdc += outUsdc;
      break;
    }

    case "swap_pow_usdc": {
      if (lp.pow === 0 || lp.usdc === 0) throw new Error("POOL_EMPTY");
      if (wFrom.pow < amt) throw new Error("NO_FUNDS");
      const powIn = amt;
      const k = lp.pow * lp.usdc;
      const newPow = lp.pow + powIn;
      const newUsdc = Math.floor(k / newPow);
      const usdcOut = lp.usdc - newUsdc;
      if (usdcOut <= 0) throw new Error("NO_LIQ");
      const fee = Math.floor(usdcOut * 2 / 100); // 2% fee vers trésorerie
      const net = usdcOut - fee;

      wFrom.pow -= powIn;
      wFrom.usdc += net;
      lp.pow = newPow;
      lp.usdc = newUsdc + fee;

      wallets[TREASURY_ADDR].usdc += fee;
      break;
    }

    case "swap_usdc_pow": {
      if (lp.pow === 0 || lp.usdc === 0) throw new Error("POOL_EMPTY");
      if (wFrom.usdc < amt) throw new Error("NO_FUNDS");
      const usdcIn = amt;
      const k = lp.pow * lp.usdc;
      const newUsdc = lp.usdc + usdcIn;
      const newPow = Math.floor(k / newUsdc);
      const powOut = lp.pow - newPow;
      if (powOut <= 0) throw new Error("NO_LIQ");
      const fee = Math.floor(powOut * 2 / 100);
      const net = powOut - fee;

      wFrom.usdc -= usdcIn;
      wFrom.pow += net;
      lp.usdc = newUsdc;
      lp.pow = newPow + fee;

      wallets[TREASURY_ADDR].pow += fee;
      break;
    }

    default:
      throw new Error("TYPE_UNKNOWN");
  }

  wFrom.nonce += 1;
}

// ===== Bloc + auto-minage =====

function makeHash(obj) {
  // hash léger (pas cryptographique, mais suffisant pour visualiser)
  const s = JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function mineBlock() {
  if (!mempool.length) return;
  const height = chainHeight() + 1;
  const ts = Date.now();
  const txs = mempool.splice(0, mempool.length);
  const prev = chain.length ? chain[chain.length - 1].hash : "GENESIS";

  try {
    // On applique les tx de façon déterministe
    for (const tx of txs) applyTx(tx);

    const blk = {
      height,
      time: ts,
      prev,
      txs,
      validator: TREASURY_ADDR, // pour l’instant : ce node
    };
    blk.hash = makeHash(blk);
    chain.push(blk);

    const reward = Math.floor(10 * DEC);
    wallets[TREASURY_ADDR].pow += reward;

    log("✅ Bloc", height, "miné avec", txs.length, "tx");
    broadcast({ type: "block", block: blk, stats: getStats() });
  } catch (e) {
    log("❌ Erreur bloc, rollback mempool:", e.message);
    // Si ça plante, on remet les tx dans le mempool (simple)
    mempool.unshift(...txs);
  }
}

function getStats() {
  const { pow, usdc } = getSupply();
  const t = wallets[TREASURY_ADDR] || { pow: 0, usdc: 0, staked: 0 };
  return {
    height: chainHeight(),
    blocks: chain.length,
    mempool: mempool.length,
    lp,
    supplyPow: pow,
    supplyUsdc: usdc,
    treasuryPow: t.pow,
    treasuryUsdc: t.usdc,
    treasuryStaked: t.staked
  };
}

// ===== API HTTP =====

// Stats pour ton dashboard
app.get("/stats", (req, res) => {
  res.json(getStats());
});

// Récup d’un wallet
app.get("/wallet/:addr", (req, res) => {
  const addr = req.params.addr;
  const w = wallets[addr];
  if (!w) return res.status(404).json({ error: "NOT_FOUND" });
  res.json(w);
});

// Soumission de tx signée
app.post("/tx", (req, res) => {
  const tx = req.body;
  try {
      const basicErr = validateTxBasic(tx);
      if (basicErr) return res.status(400).json({ ok: false, error: "BAD_" + basicErr });

      if (!verifySig(tx)) return res.status(400).json({ ok: false, error: "BAD_SIG" });

      // On ne l’applique pas encore, on la met dans le mempool,
      // l’application réelle se fait dans mineBlock()
      mempool.push(tx);
      broadcast({ type: "mempool", mempool: mempool.length });
      res.json({ ok: true });
  } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
  }
});

// ===== WebSocket =====

wss.on("connection", ws => {
  log("🌐 Client WS connecté");
  ws.send(JSON.stringify({ type: "hello", stats: getStats(), chainHeight: chainHeight() }));
});

// ===== Genesis + boucle de bloc =====

function initGenesis() {
  if (chain.length) return;
  const genesis = {
    height: 1,
    time: Date.now(),
    prev: null,
    txs: [],
    validator: "GENESIS"
  };
  genesis.hash = makeHash(genesis);
  chain.push(genesis);
  log("🚀 Genesis créé, height=1");
}

initGenesis();
setInterval(mineBlock, 5000);

// ===== Lancement serveur =====

const PORT = 3000;
const WSPORT = 7001;

httpServer.listen(PORT, () => {
  log("🔥 POWCHAIN HTTP+WS en ligne sur port", PORT, "(WS path /ws, port interne", WSPORT, ")");
});