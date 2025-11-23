// POWCHAIN — mini validator + API pour client JARVIS

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const WebSocket = require("ws");

// ---------- CONSTANTES ----------
const DEC = 1e6;
const TREASURY_ADDR = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

// ---------- ÉTAT EN MÉMOIRE ----------
let state = {
  height: 0,
  lpPow: 0,
  lpUsdc: 0,
  treasuryUsdc: 0,
  treasurySol: 0,
  treasuryAddr: TREASURY_ADDR,
};

const wallets = {};   // addr -> {pow,usdc,staked,nonce}
const mempool = [];   // txs en attente
const blocks  = [];   // chaîne simple

function getWallet(addr) {
  if (!wallets[addr]) {
    wallets[addr] = { pow: 0, usdc: 0, staked: 0, nonce: 0 };
  }
  return wallets[addr];
}

// Crédit de base de la trésorerie pour tester
getWallet(TREASURY_ADDR).usdc = 1_000_000 * DEC;
state.treasuryUsdc = getWallet(TREASURY_ADDR).usdc;

// ---------- UTILITAIRES HTTP ----------
function sendHtml(res, code, html) {
  res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}
function sendJson(res, obj) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}
function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("404");
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ---------- LOGIQUE DES TX ----------
function applyTx(tx) {
  const wFrom = getWallet(tx.from);
  if (tx.nonce != null && tx.nonce <= wFrom.nonce) return false;

  if (tx.type === "SEND") {
    const amt = tx.amount || 0;
    if (amt <= 0) return false;
    if (!tx.to) return false;
    const wTo = getWallet(tx.to);
    if (wFrom.pow < amt) return false;
    wFrom.pow -= amt;
    wTo.pow += amt;
  }

  if (tx.type === "LP_ADD") {
    const p = tx.pow || 0;
    const u = tx.usdc || 0;
    if (p <= 0 || u <= 0) return false;
    if (wFrom.pow < p || wFrom.usdc < u) return false;
    wFrom.pow -= p;
    wFrom.usdc -= u;
    state.lpPow += p;
    state.lpUsdc += u;
  }

  if (tx.type === "SWAP") {
    const amt = tx.amount || 0;
    if (amt <= 0) return false;
    if (!state.lpPow || !state.lpUsdc) return false;

    // AMM x*y=k avec fee 0.3% vers la trésorerie
    const feeRate = 0.003;

    if (tx.token === "pow2usdc") {
      if (wFrom.pow < amt) return false;

      const amountInNoFee = Math.floor(amt * (1 - feeRate));
      const x = state.lpPow;
      const y = state.lpUsdc;
      const k = BigInt(x) * BigInt(y);

      const newX = x + amountInNoFee;
      const newY = k / BigInt(newX);
      let out = y - Number(newY);
      if (out <= 0) return false;

      wFrom.pow -= amt;
      wFrom.usdc += out;
      state.lpPow = newX;
      state.lpUsdc = Number(newY);
      state.treasuryUsdc += amt - amountInNoFee;
    } else if (tx.token === "usdc2pow") {
      if (wFrom.usdc < amt) return false;

      const amountInNoFee = Math.floor(amt * (1 - feeRate));
      const x = state.lpUsdc;
      const y = state.lpPow;
      const k = BigInt(x) * BigInt(y);

      const newX = x + amountInNoFee;
      const newY = k / BigInt(newX);
      let out = y - Number(newY);
      if (out <= 0) return false;

      wFrom.usdc -= amt;
      wFrom.pow += out;
      state.lpUsdc = newX;
      state.lpPow = Number(newY);
      state.treasuryUsdc += amt - amountInNoFee;
    } else {
      return false;
    }
  }

  if (tx.nonce != null) wFrom.nonce = tx.nonce;
  return true;
}

// ---------- BLOCS ----------
function forgeBlock() {
  if (!mempool.length) return null;
  const txs = mempool.splice(0, mempool.length);
  state.height += 1;

  const blk = {
    height: state.height,
    time: Date.now(),
    validator: "POWCHAIN-DEV",
    txs,
  };

  blk.hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(blk))
    .digest("hex");

  blocks.push(blk);
  return blk;
}

// ---------- SERVEUR HTTP ----------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname || "/";

  // 1) FRONT : sert /client/index.html comme page principale
  if (req.method === "GET" && pathname === "/") {
    const filePath = path.join(__dirname, "client", "index.html");
    fs.readFile(filePath, (err, buf) => {
      if (err) return notFound(res);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(buf);
    });
    return;
  }

  // 2) Fichiers statiques /client/*.js, /client/*.css, etc.
  if (req.method === "GET" && pathname.startsWith("/client/")) {
    const filePath = path.join(__dirname, pathname);
    fs.readFile(filePath, (err, buf) => {
      if (err) return notFound(res);
      let type = "text/plain; charset=utf-8";
      if (filePath.endsWith(".html")) type = "text/html; charset=utf-8";
      else if (filePath.endsWith(".js"))
        type = "application/javascript; charset=utf-8";
      else if (filePath.endsWith(".css"))
        type = "text/css; charset=utf-8";
      res.writeHead(200, { "Content-Type": type });
      res.end(buf);
    });
    return;
  }

  // 3) API /stats
  if (req.method === "GET" && pathname === "/stats") {
    const s = {
      height: state.height,
      lpPow: state.lpPow,
      lpUsdc: state.lpUsdc,
      treasuryUsdc: state.treasuryUsdc,
      treasurySol: state.treasurySol,
      treasuryAddr: state.treasuryAddr,
    };
    return sendJson(res, s);
  }

  // 4) API /wallet/:addr
  if (req.method === "GET" && pathname.startsWith("/wallet/")) {
    const addr = decodeURIComponent(pathname.slice("/wallet/".length));
    const w = getWallet(addr);
    return sendJson(res, { addr, ...w });
  }

  // 5) API /block/:h
  if (req.method === "GET" && pathname.startsWith("/block/")) {
    const hStr = pathname.slice("/block/".length);
    const h = parseInt(hStr, 10);
    const blk = blocks.find(b => b.height === h);
    if (!blk) return notFound(res);
    return sendJson(res, blk);
  }

  // 6) POST /tx (SWAP / LP_ADD / SEND)
  if (req.method === "POST" && pathname === "/tx") {
    try {
      const tx = await parseBody(req);
      if (!tx || !tx.type || !tx.from) {
        res.writeHead(400);
        return res.end("bad tx");
      }
      if (!applyTx(tx)) {
        res.writeHead(400);
        return res.end("rejected");
      }
      mempool.push(tx);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500);
      return res.end("error");
    }
  }

  // fallback
  return notFound(res);
});

// ---------- WEBSOCKET ----------
const wss = new WebSocket.Server({ server });

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "hello", treasury: state.treasuryAddr }));
});

// Boucle bloc automatique
setInterval(() => {
  const blk = forgeBlock();
  if (blk) broadcast({ type: "block", height: blk.height, hash: blk.hash });
}, 4000);

// ---------- LANCEMENT ----------
const PORT = 80; // mets 80 si tu veux que Cloudflare pointe sur le port HTTP standard
server.listen(PORT, () => {
  console.log("POWCHAIN validator + API en ligne sur port", PORT);
});
