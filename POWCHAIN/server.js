const fs = require("fs");
const http = require("http");
const express = require("express");
const WebSocket = require("ws");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

let state = {
  height: 0,
  pow: 1000000,
  lp: 100000,
  price: 1,
  producer: "TREASURY_POWCHAIN",
  blocks: []
};

// ===== API STATS =====
app.get("/stats", (req, res) => {
  res.json({
    pow: state.pow,
    lp: state.lp,
    price: state.price,
    producer: state.producer,
    height: state.height,
    blocks: state.blocks.slice(-20)
  });
});

// ===== WebSocket clients =====
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "chain", ...state }));
  console.log("WS client connecté");

  ws.on("message", msg => {
    try {
      const d = JSON.parse(msg);

      if (d.type === "search_wallet")
        return ws.send(JSON.stringify({ type: "wallet", pub: d.wallet, balance: Math.random()*2000 }));

      if (d.type === "search_tx")
        return ws.send(JSON.stringify({ type: "tx", id: d.id, status: "OK" }));

    } catch {}
  });
});

// ===== Production des blocs automatiques =====
setInterval(() => {
  state.height++;
  const block = {
    height: state.height,
    producer: state.producer,
    ts: Date.now()
  };
  state.blocks.push(block);
  wss.clients.forEach(c => c.send(JSON.stringify({ type: "block", block })));
  wss.clients.forEach(c => c.send(JSON.stringify({ type: "chain", ...state })));
  console.log("Bloc", state.height);
}, 5000);

server.listen(3000, () => console.log("POWCHAIN server en ligne sur port 3000"));