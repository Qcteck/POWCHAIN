const http = require("http");
const WebSocket = require("ws");

// ===========================
//   ÉTAT POWCHAIN (démo)
// ===========================
let height = 0;
let supplyPow = 1_000_000;
let supplyLp = 100_000;
let pricePow = 1;
let mempool = [];
const TREASURY = "TREASURY_POWCHAIN";

// ===========================
//   SERVEUR HTTP + WS
// ===========================
const server = http.createServer();
const wss = new WebSocket.Server({ noServer: true });

// Broadcast de l’état explorer
function broadcastExplorer() {
  const payload = {
    type: "explorer",
    data: {
      height,
      producer: TREASURY,
      supplyPow,
      supplyLpPow: supplyLp,
      pricePow,
      mempool,
      timestamp: Date.now()
    }
  };
  const json = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(json);
  });
}

// Petit auto-mining pour voir la chaîne bouger
setInterval(() => {
  height++;
  // mini variation du prix POW
  pricePow = pricePow * (1 + (Math.random() - 0.5) / 150);
  if (pricePow < 0.000001) pricePow = 0.000001;
  broadcastExplorer();
}, 4000);

// Gestion des connexions WS
wss.on("connection", ws => {
  ws.send(JSON.stringify({ type: "info", msg: "WebSocket POWCHAIN connecté" }));
  // envoie l’état actuel dès la connexion
  broadcastExplorer();
});

// Upgrade HTTP -> WS sur /ws uniquement
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/ws") {
    wss.handleUpgrade(req, socket, head, sock => {
      wss.emit("connection", sock, req);
    });
  } else {
    socket.destroy();
  }
});

// Lancement
const PORT = 3000;
server.listen(PORT, () => {
  console.log("🚀 POWCHAIN validator + WS actif sur port", PORT);
});