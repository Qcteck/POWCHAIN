const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");

const PORT = 3000;
const WSPORT = 7001;

let chain = [];
let mempool = [];
let state = {
  height: 0,
  supplyPOW: 100000000,
  balances: {},
  lpPOW: 0,
  lpUSDC: 0
};

function hash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function genesis() {
  const block = {
    index: 0,
    prev: "0",
    time: Date.now(),
    txs: [],
    hash: ""
  };
  block.hash = hash(JSON.stringify(block));
  chain.push(block);
  state.height = 1;
}

if (!fs.existsSync("/root/powchain/chain.json")) {
  genesis();
  save();
} else {
  load();
}

function save() {
  fs.writeFileSync("/root/powchain/chain.json", JSON.stringify({ chain, state }, null, 2));
}

function load() {
  const f = JSON.parse(fs.readFileSync("/root/powchain/chain.json"));
  chain = f.chain;
  state = f.state;
}

function applyTx(tx) {
  if (!tx.from || !tx.to || !tx.token || !tx.amount) return false;
  if (!state.balances[tx.from]) state.balances[tx.from] = { POW: 0, USDC: 0 };
  if (!state.balances[tx.to]) state.balances[tx.to] = { POW: 0, USDC: 0 };
  if (state.balances[tx.from][tx.token] < tx.amount) return false;
  state.balances[tx.from][tx.token] -= tx.amount;
  state.balances[tx.to][tx.token] += tx.amount;
  return true;
}

function mine() {
  if (mempool.length === 0) return;
  const block = {
    index: chain.length,
    prev: chain[chain.length - 1].hash,
    time: Date.now(),
    txs: [...mempool],
    hash: ""
  };
  for (const tx of mempool) applyTx(tx);
  mempool = [];
  block.hash = hash(JSON.stringify(block));
  chain.push(block);
  state.height = chain.length;
  save();
  broadcast(JSON.stringify({ type: "block", block }));
}

function broadcast(msg) {
  for (const c of wss.clients) {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  }
}

function api(req, res) {
  if (req.method === "GET" && req.url === "/stats") {
    return res.end(JSON.stringify({
      height: state.height,
      supplyPOW: state.supplyPOW,
      lpPOW: state.lpPOW,
      lpUSDC: state.lpUSDC
    }));
  }
  if (req.method === "POST" && req.url === "/tx") {
    let body = "";
    req.on("data", d => body += d);
    req.on("end", () => {
      try {
        const tx = JSON.parse(body);
        mempool.push(tx);
        broadcast(JSON.stringify({ type: "mempool", mempool: mempool.length }));
        res.end("OK");
      } catch (e) {
        res.statusCode = 400;
        res.end("ERR");
      }
    });
    return;
  }
  res.statusCode = 404;
  res.end("NF");
}

setInterval(mine, 5000);

const server = http.createServer(api);
server.listen(PORT);

const wss = new WebSocket.Server({ port: WSPORT });
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "hello", height: state.height }));
});

console.log("HTTP API online", PORT);
console.log("WS online", WSPORT);