const http = require("http");
const fs = require("fs");
const crypto = require("crypto");

const PORT = 3000;
const DATA = "./powchain.json";

// ----------------------------------------------------------------
// Chargement ou création du fichier de blockchain local
// ----------------------------------------------------------------
let state = fs.existsSync(DATA)
  ? JSON.parse(fs.readFileSync(DATA, "utf8"))
  : { wallets:{}, mempool:[], blocks:[], blockTX:5, totalPOW:0 };

// ----------------------------------------------------------------
// Génération auto d’un wallet POWCHAIN si aucun n’existe
// ----------------------------------------------------------------
function ensureWallet(){
  if(!state.wallets.self){
    const priv = crypto.randomBytes(32).toString("hex");
    const pub = crypto.createHash("sha256").update(priv).digest("hex").slice(0,40);
    state.wallets.self = {pub, priv, pow:1000, usdc:100};  // démarrage miné
    save();
    console.log("Wallet généré →", pub);
  }
}
ensureWallet();

// ----------------------------------------------------------------
function save(){ fs.writeFileSync(DATA, JSON.stringify(state,null,2)); }

// ----------------------------------------------------------------
// Validation TX → ajout dans mempool + mining auto
// ----------------------------------------------------------------
function addTx(tx){
  state.mempool.push(tx);
  if(state.mempool.length >= state.blockTX) mine();
  save();
}

// ----------------------------------------------------------------
// Mine un bloc
// ----------------------------------------------------------------
function mine(){
  const reward = 10;
  const txs = state.mempool.splice(0, state.blockTX);
  state.blocks.push({ts:Date.now(), txs});
  state.wallets.self.pow += reward;
  state.totalPOW += reward;
  save();
}

// ----------------------------------------------------------------
// Création serveur HTTP
// ----------------------------------------------------------------
http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");

  if(req.url === "/balance"){
    return res.end(JSON.stringify(state.wallets.self));
  }

  if(req.url.startsWith("/send")){
    const url = new URL(req.url, "http://x");
    const to = url.searchParams.get("to");
    const amount = Number(url.searchParams.get("amount")||0);
    if(amount<=0) return res.end(JSON.stringify({err:"amount"}));

    if(state.wallets.self.pow < amount) return res.end(JSON.stringify({err:"founds"}));

    if(!state.wallets[to]) state.wallets[to] = {pub:to, pow:0, usdc:0};
    state.wallets.self.pow -= amount;
    state.wallets[to].pow += amount;

    addTx({type:"SEND",from:state.wallets.self.pub,to,amount});
    return res.end(JSON.stringify({ok:true}));
  }

  if(req.url.startsWith("/swap")){
    const url = new URL(req.url, "http://x");
    const type = url.searchParams.get("type");
    const amount = Number(url.searchParams.get("amount")||0);
    if(type==="POW→USDC" && state.wallets.self.pow>=amount){
      state.wallets.self.pow -= amount;
      state.wallets.self.usdc += amount;
      addTx({type:"SWAP_P2U",amount});
    }
    if(type==="USDC→POW" && state.wallets.self.usdc>=amount){
      state.wallets.self.usdc -= amount;
      state.wallets.self.pow += amount;
      addTx({type:"SWAP_U2P",amount});
    }
    return res.end(JSON.stringify({ok:true}));
  }

  if(req.url === "/mempool"){
    return res.end(JSON.stringify(state.mempool));
  }

  if(req.url === "/blocks"){
    return res.end(JSON.stringify(state.blocks));
  }

  // Client HTML
  if(req.url === "/" || req.url === "/client"){
    res.setHeader("Content-Type","text/html");
    return res.end(fs.readFileSync("./client/index.html"));
  }

  // Fichiers statiques du dossier client
  if(req.url.startsWith("/client/")){
    const path = "." + req.url;
    if(fs.existsSync(path)) return res.end(fs.readFileSync(path));
  }

  res.end("POWCHAIN SERVER OK");
}).listen(PORT, ()=>console.log("POWCHAIN server on", PORT));