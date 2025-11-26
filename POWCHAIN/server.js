const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

let height = 0;
let chain = [];
let mempool = [];
let supplyPow = 1000000;
let supplyLp = 100000;
let pricePow = 1;
const treasury = "TREASURY_POWCHAIN";

const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

function broadcastExplorer() {
  const data = {
    height,
    producer: treasury,
    supplyPow,
    supplyLpPow: supplyLp,
    pricePow,
    mempool,
    timestamp: Date.now()
  };
  const msg = JSON.stringify({ type: "explorer", data });
  wss.clients.forEach(c => c.readyState === WebSocket.OPEN && c.send(msg));
}

// Auto-mining
setInterval(() => {
  height++;
  pricePow = pricePow * (1 + (Math.random() - 0.5) / 200);
  if (pricePow < 0.000001) pricePow = 0.000001;
  chain.push({ height, producer: treasury, timestamp: Date.now() });
  broadcastExplorer();
}, 4000);

// WS handler
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "info", msg: "WS connecté" }));
  broadcastExplorer();
});

// /ws endpoint
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws, req));
  } else socket.destroy();
});

server.listen(3000, () => console.log("🚀 POWCHAIN Validator online on port 3000"));