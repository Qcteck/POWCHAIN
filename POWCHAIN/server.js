// POWCHAIN - mini validator + API pour client JARVIS
const http = require("http");
const url = require("url");
const crypto = require("crypto");

// --------- ÉTAT POWCHAIN EN MÉMOIRE ---------
const DEC = 1e6;
const TREASURY_ADDR = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";

let state = {
  height: 0,
  lpPow: 0,
  lpUsdc: 0,
  treasuryUsdc: 0,
  treasurySol: 0,
  treasuryAddr: TREASURY_ADDR,
};

const wallets = {}; // addr -> {pow,usdc,staked,nonce}
const mempool = []; // tx en attente
const blocks = [];  // chaîne simple

function getWallet(addr) {
  if (!wallets[addr]) {
    wallets[addr] = { pow: 0, usdc: 0, staked: 0, nonce: 0 };
  }
  return wallets[addr];
}

// Créditer la trésorerie de base pour tester
getWallet(TREASURY_ADDR).usdc = 1_000_000 * DEC; // 1M USDC POW
state.treasuryUsdc = getWallet(TREASURY_ADDR).usdc;

// --------- UTILITAIRES HTTP ---------
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
    req.on("data", chunk => (data += chunk));
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

// --------- LOGIQUE DES BLOCS ---------
function applyTx(tx) {
  const wFrom = getWallet(tx.from);
  if (tx.nonce != null && tx.nonce <= wFrom.nonce) {
    return false; // déjà utilisé / ordre invalide
  }
  if (tx.type === "SWAP") {
    const amt = tx.amount || 0;
    if (tx.token === "pow2usdc") {
      // POW -> USDC POW
      if (wFrom.pow < amt) return false;
      wFrom.pow -= amt;
      wFrom.usdc += amt; // 1:1 pour demo
      state.lpPow += amt;
      state.lpUsdc -= amt;
    } else if (tx.token === "usdc2pow") {
      // USDC POW -> POW
      if (wFrom.usdc < amt) return false;
      wFrom.usdc -= amt;
      wFrom.pow += amt;
      state.lpUsdc += amt;
      state.lpPow -= amt;
    }
  } else if (tx.type === "LP_ADD") {
    const p = tx.pow || 0;
    const u = tx.usdc || 0;
    if (wFrom.pow < p || wFrom.usdc < u) return false;
    wFrom.pow -= p;
    wFrom.usdc -= u;
    state.lpPow += p;
    state.lpUsdc += u;
  } else if (tx.type === "SEND") {
    const amt = tx.amount || 0;
    const token = tx.token || "POW";
    if (token === "POW") {
      if (wFrom.pow < amt) return false;
      wFrom.pow -= amt;
      getWallet(tx.to).pow += amt;
    } else if (token === "USDC") {
      if (wFrom.usdc < amt) return false;
      wFrom.usdc -= amt;
      getWallet(tx.to).usdc += amt;
    }
  }
  // nonce OK
  if (tx.nonce != null) wFrom.nonce = tx.nonce;
  return true;
}

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
  const h = crypto
    .createHash("sha256")
    .update(JSON.stringify(blk))
    .digest("hex");
  blk.hash = h;
  blocks.push(blk);
  return blk;
}

// --------- PAGE SIMPLE "POWCHAIN ONLINE" ---------
const PAGE_INDEX = `<!doctype html><html><head><meta charset="utf-8"/><title>POWCHAIN ONLINE</title><style>body{background:#000;color:#0ff;font-family:Arial;text-align:center;padding-top:60px}a{color:#0ff} .box{background:#001c41;border:1px solid #0ff;padding:20px;border-radius:10px;display:inline-block}</style></head><body><h1>POWCHAIN ONLINE</h1><div class="box"><p>Client connecté au serveur POWCHAIN</p><p>IP serveur: 72.60.65.18 — Port: 3000</p><a href="/balance">Voir SOLDE</a><br/><br/><a href="/mempool">Voir MEMPOOL</a><br/><br/><a href="/blocks">Voir BLOCKS</a><br/><br/><a href="/send?to=TEST&amount=1" style="color:red">Tester SEND (1 POW → TEST)</a></div></body></html>`;

// --------- SERVEUR HTTP ---------
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const path = parsed.pathname || "/";

  // CORS simple pour ton client HTML externe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // PAGE SIMPLE
  if (req.method === "GET" && path === "/") {
    return sendHtml(res, 200, PAGE_INDEX);
  }

  // -------- API POUR VIEUX CLIENT --------
  if (req.method === "GET" && path === "/balance") {
    return sendHtml(
      res,
      200,
      "<pre>" + JSON.stringify(wallets, null, 2) + "</pre>"
    );
  }
  if (req.method === "GET" && path === "/mempool") {
    return sendHtml(
      res,
      200,
      "<pre>" + JSON.stringify(mempool, null, 2) + "</pre>"
    );
  }
  if (req.method === "GET" && path === "/blocks") {
    return sendHtml(
      res,
      200,
      "<pre>" + JSON.stringify(blocks, null, 2) + "</pre>"
    );
  }
  if (req.method === "GET" && path === "/send") {
    // petit test : créditer POW et envoyer
    const from = TREASURY_ADDR;
    const to = parsed.query.to || "TEST";
    const amount = parseInt(parsed.query.amount || "1") * DEC;
    const tx = {
      type: "SEND",
      from,
      to,
      amount,
      token: "POW",
      nonce: getWallet(from).nonce + 1,
    };
    mempool.push(tx);
    applyTx(tx);
    forgeBlock();
    return sendHtml(
      res,
      200,
      `<p>TX envoyée de ${from} vers ${to} (${amount / DEC} POW)</p><p><a href="/">Retour</a></p>`
    );
  }

  // -------- API POUR CLIENT JARVIS --------

  // /stats : résumé réseau
  if (req.method === "GET" && path === "/stats") {
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

  // /wallet/:addr
  if (req.method === "GET" && path.startsWith("/wallet/")) {
    const addr = decodeURIComponent(path.slice("/wallet/".length));
    const w = getWallet(addr);
    return sendJson(res, { addr, ...w });
  }

  // /block/:h
  if (req.method === "GET" && path.startsWith("/block/")) {
    const hStr = path.slice("/block/".length);
    const h = parseInt(hStr, 10);
    const blk = blocks.find(b => b.height === h);
    if (!blk) return notFound(res);
    return sendJson(res, blk);
  }

  // POST /tx  (SWAP / LP_ADD / SEND)
  if (req.method === "POST" && path === "/tx") {
    try {
      const tx = await parseBody(req);
      if (!tx || !tx.type || !tx.from) {
        res.writeHead(400);
        return res.end("Bad tx");
      }
      // on applique direct + on ajoute au mempool pour l'historique
      if (!applyTx(tx)) {
        res.writeHead(400);
        return res.end("TX invalid");
      }
      mempool.push(tx);
      const blk = forgeBlock();
      state.treasuryUsdc = getWallet(TREASURY_ADDR).usdc;
      return sendJson(res, { ok: true, height: state.height, block: blk });
    } catch (e) {
      res.writeHead(500);
      return res.end("Server error: " + e.message);
    }
  }

  // fallback
  return notFound(res);
});

// --------- LANCEMENT ---------
const PORT = 3000;
server.listen(PORT, () => {
  console.log("POWCHAIN server listening on port", PORT);
});
