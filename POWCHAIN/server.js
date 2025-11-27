// POWCHAIN — Validator + API + WS + LP + Swap + Mempool + Auto-block
const express=require("express");
const bodyParser=require("body-parser");
const WebSocket=require("ws");
const nacl=require("tweetnacl");
const bs58=require("bs58");

const app=express();
app.use(bodyParser.json());

const DEC=1e6;

// ================== ÉTAT POWCHAIN ==================
let chain=[];              // {height,time,txs}
let wallets={};            // addr -> {pow,usdc,staked,nonce,pub}
let mempool=[];            // tx en attente
let height=0;
let lpPow=0,lpUsdc=0;

// ================== WALLET / GENESIS ==================
const treasury={addr:null,pub:null,priv:null};

(function initTreasury(){
  const kp=nacl.sign.keyPair();
  const pub=bs58.encode(kp.publicKey);
  const priv=bs58.encode(kp.secretKey);
  treasury.addr=pub;
  treasury.pub=pub;
  treasury.priv=priv;
  wallets[treasury.addr]={pow:0,usdc:0,staked:0,nonce:0,pub:treasury.pub};
  console.log("💰 Trésorerie POWCHAIN:",treasury.addr);
})();

function ensureWallet(addr){
  if(!wallets[addr]){
    wallets[addr]={pow:0,usdc:0,staked:0,nonce:0,pub:null};
  }
}

// ================== APPLICATION DES TX ==================
function applyTx(tx){
  try{
    const type=tx.type;
    if(type==="mint_pow"){
      if(tx.from!==treasury.addr)return;
      ensureWallet(tx.to);
      wallets[tx.to].pow+=tx.amount;
      lpPow+=0; // pas de LP ici
    }else if(type==="mint_usdc"){
      if(tx.from!==treasury.addr)return;
      ensureWallet(tx.to);
      wallets[tx.to].usdc+=tx.amount;
      lpUsdc+=0;
    }else if(type==="transfer_pow"){
      ensureWallet(tx.from);ensureWallet(tx.to);
      if(wallets[tx.from].pow<tx.amount)return;
      wallets[tx.from].pow-=tx.amount;
      wallets[tx.to].pow+=tx.amount;
    }else if(type==="transfer_usdc"){
      ensureWallet(tx.from);ensureWallet(tx.to);
      if(wallets[tx.from].usdc<tx.amount)return;
      wallets[tx.from].usdc-=tx.amount;
      wallets[tx.to].usdc+=tx.amount;
    }else if(type==="stake"){
      ensureWallet(tx.from);
      if(wallets[tx.from].pow<tx.amount)return;
      wallets[tx.from].pow-=tx.amount;
      wallets[tx.from].staked+=tx.amount;
    }else if(type==="unstake"){
      ensureWallet(tx.from);
      if(wallets[tx.from].staked<tx.amount)return;
      wallets[tx.from].staked-=tx.amount;
      wallets[tx.from].pow+=tx.amount;
    }else if(type==="lp_add"){
      // ajout simple de liquidité POW/USDC
      ensureWallet(tx.from);
      if(wallets[tx.from].pow<tx.pow||wallets[tx.from].usdc<tx.usdc)return;
      wallets[tx.from].pow-=tx.pow;
      wallets[tx.from].usdc-=tx.usdc;
      lpPow+=tx.pow;
      lpUsdc+=tx.usdc;
    }else if(type==="swap_pow_usdc"){
      // AMM x*y=k ultra simple (frais 0.2% vers trésorerie)
      ensureWallet(tx.from);
      if(tx.side==="pow_to_usdc"){
        if(wallets[tx.from].pow<tx.amount)return;
        if(lpPow<=0||lpUsdc<=0)return;
        const powIn=tx.amount;
        const powInAfter=powIn*0.998;
        const newPow=lpPow+powInAfter;
        const k=lpPow*lpUsdc;
        const newUsdc=k/newPow;
        const out=lpUsdc-newUsdc;
        if(out<=0)return;
        wallets[tx.from].pow-=powIn;
        wallets[tx.from].usdc+=out;
        lpPow=newPow;
        lpUsdc=newUsdc;
        wallets[treasury.addr].pow+=(powIn-powInAfter);
      }else if(tx.side==="usdc_to_pow"){
        if(wallets[tx.from].usdc<tx.amount)return;
        if(lpPow<=0||lpUsdc<=0)return;
        const usdcIn=tx.amount;
        const usdcInAfter=usdcIn*0.998;
        const newUsdc=lpUsdc+usdcInAfter;
        const k=lpPow*lpUsdc;
        const newPow=k/newUsdc;
        const out=lpPow-newPow;
        if(out<=0)return;
        wallets[tx.from].usdc-=usdcIn;
        wallets[tx.from].pow+=out;
        lpUsdc=newUsdc;
        lpPow=newPow;
        wallets[treasury.addr].usdc+=(usdcIn-usdcInAfter);
      }
    }
  }catch(e){
    console.error("❌ applyTx error",e);
  }
}

// ================== API HTTP ==================
app.get("/stats",(req,res)=>{
  res.json({
    height,
    blocks:chain.length,
    wallets:Object.keys(wallets).length,
    lpPow,
    lpUsdc,
    treasury:treasury.addr
  });
});

app.get("/wallet/:addr",(req,res)=>{
  const a=req.params.addr;
  ensureWallet(a);
  res.json(wallets[a]);
});

app.post("/tx",(req,res)=>{
  const tx=req.body;
  if(!tx||!tx.type||!tx.from||!tx.pub||!tx.nonce||!tx.sig){
    return res.status(400).json({error:"tx_incomplete"});
  }
  try{
    const msgObj={
      type:tx.type,
      from:tx.from,
      to:tx.to||"",
      amount:tx.amount||0,
      token:tx.token||"POW",
      nonce:tx.nonce
    };
    const msg=new TextEncoder().encode(JSON.stringify(msgObj));
    const pubKey=bs58.decode(tx.pub);
    const sig=bs58.decode(tx.sig);
    if(!nacl.sign.detached.verify(msg,sig,pubKey)){
      return res.status(400).json({error:"bad_sig"});
    }
    ensureWallet(tx.from);
    if(wallets[tx.from].nonce+1!==tx.nonce){
      return res.status(400).json({error:"bad_nonce",expected:wallets[tx.from].nonce+1});
    }
    wallets[tx.from].nonce=tx.nonce;
    mempool.push(tx);
    res.json({ok:true,queued:true,mempool:mempool.length});
  }catch(e){
    console.error("❌ Erreur /tx",e);
    res.status(500).json({error:"server_error"});
  }
});

// ================== SERVEUR HTTP ==================
const httpServer=app.listen(3000,()=>{
  console.log("🔥 POWCHAIN en ligne sur port 3000");
});

// ================== WEBSOCKET ==================
const wss=new WebSocket.Server({port:7001});
const wsClients=new Set();

wss.on("connection",ws=>{
  wsClients.add(ws);
  ws.send(JSON.stringify({
    type:"hello",
    height,
    wallets:Object.keys(wallets).length,
    lpPow,
    lpUsdc
  }));
  ws.on("close",()=>wsClients.delete(ws));
});

function broadcast(obj){
  const data=JSON.stringify(obj);
  for(const ws of wsClients){
    if(ws.readyState===WebSocket.OPEN){
      ws.send(data);
    }
  }
}

console.log("🔌 WS prêt sur 7001");

// ================== BOUCLE DE BLOCS ==================
setInterval(()=>{
  const txs=mempool.splice(0,mempool.length);
  height++;
  txs.forEach(applyTx);
  const block={height,time:Date.now(),txs};
  chain.push(block);
  console.log(`⛓ Bloc ${height} créé (${txs.length} tx)`);
  broadcast({type:"block",block});
},10000); // 10s

process.on("uncaughtException",err=>{
  console.error("❌ uncaughtException",err);
});
process.on("unhandledRejection",err=>{
  console.error("❌ unhandledRejection",err);
});