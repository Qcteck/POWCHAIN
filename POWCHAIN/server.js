const http = require("http");
const express = require("express");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

// --- ÉTAT POWCHAIN SIMPLE ---
let state = {
  height: 0,
  pow: 1000000,
  lp: 100000,
  price: 1,
  producer: "TREASURY_POWCHAIN",
  blocks: []
};

// --- API /stats ---
app.get("/stats", (req, res) => {
  res.json({
    pow: state.pow,
    lp: state.lp,
    price: state.price,
    producer: state.producer,
    height: state.height,
    blocks: state.blocks.slice(-30)
  });
});

// --- WEBSOCKET /ws ---
const wss = new WebSocket.Server({ server, path: "/ws" });

wss.on("connection", ws => {
  console.log("WS client connecté");
  // état complet au connect
  ws.send(JSON.stringify({ type: "chain", ...state }));
  // derniers blocs
  state.blocks.slice(-20).forEach(b => {
    ws.send(JSON.stringify({ type: "block", block: b }));
  });

  ws.on("message", msg => {
    // on garde la structure pour plus tard (search_wallet / search_tx)
    try {
      const d = JSON.parse(msg.toString());
      if (d.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      // on ne casse rien si autre type inconnu
    } catch (e) {
      console.log("WS parse error:", e.message);
    }
  });
});

// --- PRODUCTION DE BLOCS ---
setInterval(() => {
  state.height++;
  const block = {
    height: state.height,
    producer: state.producer,
    ts: Date.now()
  };
  state.blocks.push(block);
  // broadcast du nouveau bloc + état mis à jour
  const payloadBlock = JSON.stringify({ type: "block", block });
  const payloadChain = JSON.stringify({ type: "chain", ...state });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(payloadBlock);
      c.send(payloadChain);
    }
  });
  console.log("Bloc", state.height);
}, 5000);

// --- LANCEMENT ---
const PORT = 3000;
server.listen(PORT, () => {
  console.log("POWCHAIN v2 + LP running on port", PORT);
});