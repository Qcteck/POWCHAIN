const express = require("express");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const app = express();
app.use(express.json());

// Simple ping pour vérifier que le serveur répond
app.get("/", (req, res) => {
  res.send("POWCHAIN backend ONLINE ✅");
});

// Exemple de route: création d'un wallet (clé publique + privée)
app.get("/new-wallet", (req, res) => {
  const kp = nacl.sign.keyPair();
  const addr = bs58.encode(Buffer.from(kp.publicKey));
  const secret = bs58.encode(Buffer.from(kp.secretKey));
  res.json({ address: addr, secret });
});

// PORT configurable plus tard, pour l'instant 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log("POWCHAIN server running on port " + PORT);
});