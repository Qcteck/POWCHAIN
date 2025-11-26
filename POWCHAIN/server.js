/* =========================
   POWCHAIN — SERVER ULTIMATE
   ========================= */

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const http = require("http");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

// --- STORAGE FILE ---
const DB_FILE = path.join(__dirname, "state.json");

// --- STATE ---
let state = {
  height: 0,
  producer: "BOOT",
  supplyPow: 1000000,
  supplyLpPow: 200000,
  pricePow: 0.01,
  mempool: [],
  users: {},        // {addr:{pow,usdc,staked,nonce}}
  txs: [],          // history
};

// load storage
if (fs.existsSync(DB_FILE)) {
  try { state = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { console.log("⚠ DB corrompue, reset..."); }
}

// save periodically
setInterval(() => fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2)), 5000);

// --- SERVER HTTP (only to serve /ws upgrade) ---
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("POWCHAIN RUNNING");
});

// --- WS HUB ---
const wss = new WebSocket.Server({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
}

// === CREATE USER IF NEW ===
function ensureUser(addr) {
  if (!state.users[addr]) {
    state.users[addr] = { pow: 0, usdc: 0, nonce: 0 };
  }
  return state.users[addr];
}

// === VERIFY SIGNATURE ===
function verifyTx(raw, sig, pub) {
  try {
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode(JSON.stringify(raw)),
      bs58.decode(sig),
      bs58.decode(pub)
    );
    return ok;
  } catch { return false; }
}

// === APPLY TX ===
function applyTx(tx) {
  const u = ensureUser(tx.from);
  if (tx.nonce !== u.nonce + 1) return false;
  u.nonce++;

  switch (tx.action) {
    case "faucet":
      u.pow += 50;
      break;

    case "transfer":
      if (u.pow < tx.amount) return false;
      const dest = ensureUser(tx.to);
      u.pow -= tx.amount;
      dest.pow += tx.amount;
      break;

    case "swap":
      if (tx.dir === "pow-usdc") {
        if (u.pow < tx.amount) return false;
        u.pow -= tx.amount;
        u.usdc += tx.amount * state.pricePow;
      } else {
        const need = tx.amount * state.pricePow;
        if (u.usdc < need) return false;
        u.usdc -= need;
        u.pow += tx.amount;
      }
      break;

    case "bridge_in": // SOL -> POWCHAIN
      u.pow += tx.amount * 100; // = 1 SOL → 100 POW
      state.supplyPow += tx.amount * 100;
      break;

    case "bridge_out": // POWCHAIN -> SOL
      if (u.pow < tx.amount) return false;
      u.pow -= tx.amount;
      state.supplyPow -= tx.amount;
      break;

    default: return false;
  }

  return true;
}

// === BLOCK PRODUCTION ===
function produceBlock() {
  const mp = [...state.mempool];
  state.mempool = [];

  for (const tx of mp) {
    const ok = applyTx(tx);
    if (!ok) continue;
    state.txs.push({ ...tx, block: state.height + 1, timestamp: Date.now() });
  }

  state.height++;
  state.producer = "VALIDATOR";
  const k = 0.0000001;
  state.pricePow = Math.max(0.000001, state.pricePow + (mp.length * k));
  if (state.pricePow > 10) state.pricePow = 10;

  broadcast({
    type: "explorer",
    data: {
      height: state.height,
      producer: state.producer,
      supplyPow: state.supplyPow,
      supplyLpPow: state.supplyLpPow,
      pricePow: state.pricePow,
      mempool: mp.length,
      timestamp: Date.now()
    }
  });
}

// every 3 seconds
setInterval(produceBlock, 3000);

// === WS HANDLERS ===
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "info", msg: "Bienvenue sur POWCHAIN" }));

  ws.on("message", raw => {
    try {
      const msg = JSON.parse(raw);

      // only explorer request
      if (msg.type === "explorer") {
        ws.send(JSON.stringify({
          type: "explorer",
          data: {
            height: state.height,
            producer: state.producer,
            supplyPow: state.supplyPow,
            supplyLpPow: state.supplyLpPow,
            pricePow: state.pricePow,
            mempool: state.mempool.length,
            timestamp: Date.now()
          }
        }));
        return;
      }

      // tx
      if (msg.type === "tx") {
        const user = ensureUser(msg.from);
        const rawTx = msg.obj;
        rawTx.from = msg.from;
        rawTx.nonce = user.nonce + 1;

        if (!verifyTx(rawTx, msg.sig, msg.from)) {
          ws.send(JSON.stringify({ type: "info", msg: "❌ Signature invalide" }));
          return;
        }

        state.mempool.push(rawTx);
        broadcast({ type: "info", msg: `🧾 TX reçue ${rawTx.action}` });
        return;
      }

    } catch (e) {
      ws.send(JSON.stringify({ type: "info", msg: "Erreur parsing" }));
    }
  });
});

// START
const PORT = 8080;
server.listen(PORT, () => console.log("🚀 POWCHAIN ULTIMATE online port", PORT));