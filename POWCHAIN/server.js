const fs = require("fs");
const http = require("http");

const PORT = 3000;
const walletFile = "wallet.json";

// ------ Génération automatique du wallet ------
let wallet;
if (fs.existsSync(walletFile)) {
  wallet = JSON.parse(fs.readFileSync(walletFile));
} else {
  const { generateKeyPairSync } = require("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  wallet = {
    address: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    private: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
    pow: 1000,
    usdc: 0
  };
  fs.writeFileSync(walletFile, JSON.stringify(wallet, null, 2));
  console.log("🚀 Nouveau wallet généré !");
  console.log("Adresse :", wallet.address);
  console.log("Clé privée :", wallet.private);
}

// ------ Blockchain ------
let chain = [];
let mempool = [];
let lp = { pow: 50000, usdc: 50000 }; // Liquidity pool
let blockTxCount = 0;

// SHA256 util
const sha = x => require("crypto").createHash("sha256").update(JSON.stringify(x)).digest("hex");

// Crée un bloc
function mineBlock() {
  const block = {
    id: chain.length,
    time: Date.now(),
    tx: mempool.splice(0, 5),
    lp: { ...lp }
  };
  block.hash = sha(block);
  chain.push(block);
  blockTxCount = 0;
  console.log("⛏️ Bloc miné :", block.id);
}

// Ajoute une TX dans mempool
function pushTx(t) {
  mempool.push(t);
  blockTxCount++;
  if (blockTxCount >= 5) mineBlock();
}

// Swap interne
function swap(type, amount) {
  if (type === "POW→USDC" && wallet.pow >= amount) {
    const usdcRecv = (amount * lp.usdc) / lp.pow;
    wallet.pow -= amount;
    wallet.usdc += usdcRecv;
    lp.pow += amount;
    lp.usdc -= usdcRecv;
    return { pow: wallet.pow, usdc: wallet.usdc };
  }
  if (type === "USDC→POW" && wallet.usdc >= amount) {
    const powRecv = (amount * lp.pow) / lp.usdc;
    wallet.usdc -= amount;
    wallet.pow += powRecv;
    lp.usdc += amount;
    lp.pow -= powRecv;
    return { pow: wallet.pow, usdc: wallet.usdc };
  }
  return null;
}

// ------ Serveur HTTP ------
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  if (req.url === "/balance") return res.end(JSON.stringify(wallet));
  if (req.url === "/mempool") return res.end(JSON.stringify(mempool));
  if (req.url === "/blocks") return res.end(JSON.stringify(chain));

  if (req.url.startsWith("/send?to=")) {
    const url = new URL("http://x" + req.url);
    const to = url.searchParams.get("to");
    const amount = Number(url.searchParams.get("amount") || 0);
    if (wallet.pow >= amount) {
      wallet.pow -= amount;
      pushTx({ from: wallet.address, to, amount });
      return res.end(JSON.stringify({ ok: true, pow: wallet.pow }));
    }
    return res.end(JSON.stringify({ ok: false, reason: "insufficient" }));
  }

  if (req.url.startsWith("/swap?type=")) {
    const url = new URL("http://x" + req.url);
    const type = url.searchParams.get("type");
    const amount = Number(url.searchParams.get("amount") || 0);
    const r = swap(type, amount);
    if (r) return res.end(JSON.stringify({ ok: true, balance: r }));
    return res.end(JSON.stringify({ ok: false }));
  }

  return res.end(JSON.stringify({ ok: false, msg: "route unknown" }));
});

// ------ Auto sauvegarde ------
setInterval(() => fs.writeFileSync(walletFile, JSON.stringify(wallet, null, 2)), 3000);

// Lancement
server.listen(PORT, () => {
  console.log("\n🔥 POWCHAIN SERVER démarré");
  console.log("http://localhost:" + PORT);
  console.log("Adresse POW :", wallet.address);
});