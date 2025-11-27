const express = require("express");
const bodyParser = require("body-parser");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const app = express();
app.use(bodyParser.json());

let chain = [];
let mempool = [];
let wallets = {};
let treasury = "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";
let LP = { pow: 1000000, usdc: 1000000 }; // LP initial

function newBlock(type, data) {
  const block = {
    height: chain.length + 1,
    timestamp: Date.now(),
    type,
    data
  };
  chain.push(block);
}

function pricePOW() {
  return LP.usdc / LP.pow;
}

function processMempool() {
  if (mempool.length === 0) return;
  const tx = mempool.shift();
  const { from, to, amount, token } = tx;

  if (!wallets[from] || wallets[from][token] < amount) return;

  wallets[from][token] -= amount;
  if (!wallets[to]) wallets[to] = { pow: 0, usdc: 0 };
  wallets[to][token] += amount;

  newBlock("transfer", tx);
}

setInterval(() => {
  processMempool();
}, 3000);

app.post("/wallet", (req, res) => {
  const pub = req.body.pub;
  if (!wallets[pub]) wallets[pub] = { pow: 0, usdc: 0 };
  res.json(wallets[pub]);
});

app.post("/send", (req, res) => {
  const tx = req.body;
  mempool.push(tx);
  res.json({ ok: true });
});

app.post("/stake", (req, res) => {
  const { pub, amount } = req.body;
  if (!wallets[pub] || wallets[pub].pow < amount) return res.json({ ok: false });
  wallets[pub].pow -= amount;
  newBlock("stake", { pub, amount });
  res.json({ ok: true });
});

app.post("/swap", (req, res) => {
  const { pub, pow, usdc } = req.body;

  if (pow > 0) { // POW → USDC
    if (wallets[pub].pow < pow) return res.json({ ok: false });
    const output = pow * pricePOW();
    wallets[pub].pow -= pow;
    wallets[pub].usdc += output;
    LP.pow += pow;
    LP.usdc -= output;
  }

  if (usdc > 0) { // USDC → POW
    if (wallets[pub].usdc < usdc) return res.json({ ok: false });
    const output = usdc / pricePOW();
    wallets[pub].usdc -= usdc;
    wallets[pub].pow += output;
    LP.pow -= output;
    LP.usdc += usdc;
  }

  newBlock("swap", { pub, pow, usdc });
  res.json({ ok: true, price: pricePOW() });
});

app.get("/stats", (req, res) => {
  res.json({
    height: chain.length,
    LP,
    price: pricePOW(),
    mempool: mempool.length
  });
});

app.listen(3000, () => console.log("🔥 POWCHAIN en ligne sur port 3000"));