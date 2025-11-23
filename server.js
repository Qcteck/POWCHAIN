const express = require("express");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// CORS simple pour ton client
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.sendStatus(200);
  next();
});

// --------- ÉTAT POWCHAIN EN MÉMOIRE ---------
const BLOCK_REWARD = 10;               // POW par bloc
const BLOCK_TX_TARGET = 3;             // Nbr de TX avant minage auto
const TREASURY_ADDR = "TREASURY";      // À remplacer plus tard par ton vrai wallet POW

const state = {
  chain: [],
  mempool: [],
  balances: {}
};

function ensureBalance(addr){
  if(!state.balances[addr]) state.balances[addr] = 0;
}

function applyTx(tx){
  ensureBalance(tx.from);
  ensureBalance(tx.to);
  if(tx.from !== "COINBASE"){
    if(state.balances[tx.from] < tx.amount){
      throw new Error("Solde insuffisant");
    }
    state.balances[tx.from] -= tx.amount;
  }
  state.balances[tx.to] += tx.amount;
}

function hashBlock(prevHash, txs, nonce){
  const h = crypto.createHash("sha256");
  h.update(prevHash + JSON.stringify(txs) + String(nonce));
  return h.digest("hex");
}

function mineBlock(minerAddr){
  const prev = state.chain[state.chain.length-1];
  const prevHash = prev ? prev.hash : "GENESIS";
  const txs = [...state.mempool];

  // récompense de bloc
  const coinbaseTx = {
    id: "coinbase-"+Date.now(),
    from: "COINBASE",
    to: minerAddr || TREASURY_ADDR,
    amount: BLOCK_REWARD
  };
  txs.unshift(coinbaseTx);

  // applique les TX
  txs.forEach(applyTx);

  const nonce = Date.now();
  const hash = hashBlock(prevHash, txs, nonce);

  const block = {
    height: state.chain.length,
    timestamp: Date.now(),
    prevHash,
    hash,
    nonce,
    txs
  };

  state.chain.push(block);
  state.mempool = [];
  return block;
}

// bloc genesis
mineBlock(TREASURY_ADDR);

// --------- ROUTES CLIENT (HTML) ---------

// sert tout le dossier /client (tes fichiers HTML/CSS/JS)
app.use(express.static(path.join(__dirname,"client")));

// page d’accueil = ton client : http://IP:3000/
app.get("/",(req,res)=>{
  res.sendFile(path.join(__dirname,"client","index.html"));
});

// --------- API POWCHAIN ---------

// Status global rapide
app.get("/status",(req,res)=>{
  const supply = Object.values(state.balances).reduce((a,b)=>a+b,0);
  res.json({
    height: state.chain.length-1,
    mempoolSize: state.mempool.length,
    totalSupply: supply,
    lastHash: state.chain[state.chain.length-1]?.hash || null
  });
});

// Explorer : derniers blocs
app.get("/explorer",(req,res)=>{
  const latest = state.chain.slice(-10).reverse();
  res.json({blocks: latest});
});

// Tous les blocs
app.get("/blocks",(req,res)=>{
  res.json({blocks: state.chain});
});

// Mempool
app.get("/mempool",(req,res)=>{
  res.json({mempool: state.mempool});
});

// Balance d’un wallet : /balance?addr=XXXX
app.get("/balance",(req,res)=>{
  const addr = req.query.addr;
  if(!addr) return res.status(400).json({error:"addr manquant"});
  ensureBalance(addr);
  res.json({address: addr, balance: state.balances[addr]});
});

// Créer un wallet (clé publique + secrète)
app.get("/new-wallet",(req,res)=>{
  const kp = nacl.sign.keyPair();
  const address = bs58.encode(Buffer.from(kp.publicKey));
  const secret = bs58.encode(Buffer.from(kp.secretKey));
  ensureBalance(address); // démarre à 0
  res.json({address, secret});
});

// Envoyer des POW : POST /send {from,to,amount}
app.post("/send",(req,res)=>{
  try{
    const {from,to,amount} = req.body || {};
    if(!from || !to || typeof amount!=="number"){
      return res.status(400).json({error:"from, to, amount requis"});
    }
    const tx = {
      id: "tx-"+Date.now()+"-"+Math.random().toString(16).slice(2),
      from,
      to,
      amount
    };
    // on valide la TX en la simulant
    try{
      const snapshot = JSON.parse(JSON.stringify(state.balances));
      applyTx(tx);
      state.balances = snapshot; // on remet l’état, on appliquera lors du bloc
    }catch(e){
      return res.status(400).json({error:e.message});
    }

    state.mempool.push(tx);

    let mined = null;
    if(state.mempool.length >= BLOCK_TX_TARGET){
      mined = mineBlock(TREASURY_ADDR);
    }

    res.json({
      ok:true,
      tx,
      mempoolSize: state.mempool.length,
      minedBlock: mined
    });
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

// --------- DÉMARRAGE SERVEUR ---------
const PORT = process.env.PORT || 3000;
app.listen(PORT,"0.0.0.0",()=>{
  console.log("POWCHAIN server running on port "+PORT);
});