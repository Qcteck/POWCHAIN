// POWCHAIN — Serveur validateur complet
// (PoS + LP + Swap + Staking + Mempool + Auto-block + WS temps réel)

const express=require("express");
const bodyParser=require("body-parser");
const WebSocket=require("ws");
const nacl=require("tweetnacl");
const bs58=require("bs58");

const app=express();
app.use(bodyParser.json());

// CORS simple pour ton front bbqfinance.fun
app.use((req,res,next)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.sendStatus(200);
  next();
});

const DEC=1e6;

// == Base58 compat (corrige ton bug bs58.encode is not a function) ==
const b58enc=u8=>{
  if(bs58.encode) return bs58.encode(u8);
  return bs58(u8);
};
const b58dec=str=>{
  if(bs58.decode) return bs58.decode(str);
  return bs58(str);
};

// == État POWCHAIN ==
let chain=[];           // {height,time,hash,txs,validator}
let mempool=[];         // tx en attente
let height=0;

const wallets={};       // addr -> {pow,usdc,staked,nonce,pub}
const treasury={};      // {addr,priv,pub}
const lpPool={pow:0,usdc:0}; // AMM x*y=k

// == Paramètres économiques ==
const FEE_SWAP_BP=20;   // 0.20% pour la trésorerie
const BLOCK_TIME_MS=8000; // auto-block toutes les 8s si mempool non vide

// ======== INIT TRÉSORERIE + GENESIS ========

function initTreasury(){
  const kp=nacl.sign.keyPair();
  const addr=b58enc(kp.publicKey);
  const priv=b58enc(kp.secretKey);
  treasury.addr=addr;
  treasury.priv=priv;
  treasury.pub=addr;
  wallets[addr]={pow:0,usdc:0,staked:0,nonce:0,pub:addr};
  console.log("💰 Trésorerie POWCHAIN:",addr);
}

function hashBlockObj(obj){
  // hash très simple (pas pour la prod, mais suffisant pour démo)
  const s=JSON.stringify(obj);
  let h=0;
  for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
  return "POW"+h.toString(16);
}

function addBlock(txs){
  const blk={
    height:height+1,
    time:Date.now(),
    txs,
    validator:treasury.addr
  };
  blk.hash=hashBlockObj(blk);
  chain.push(blk);
  height=blk.height;
  console.log("⛓ Bloc",blk.height,"(",txs.length,"tx )");
  broadcast({type:"block",block:blk,stats:getStats()});
}

// ======== UTILITAIRES WALLET ========

function ensureWallet(addr,pubOpt){
  if(!wallets[addr]){
    wallets[addr]={pow:0,usdc:0,staked:0,nonce:0,pub:pubOpt||addr};
  }else if(pubOpt && !wallets[addr].pub){
    wallets[addr].pub=pubOpt;
  }
  return wallets[addr];
}

function getStats(){
  let totalPow=0,totalUsdc=0,totalStaked=0;
  for(const a in wallets){
    const w=wallets[a];
    totalPow+=w.pow;
    totalUsdc+=w.usdc;
    totalStaked+=w.staked;
  }
  return {
    height,
    totalPow,
    totalUsdc,
    totalStaked,
    lpPow:lpPool.pow,
    lpUsdc:lpPool.usdc,
    treasury:treasury.addr,
    wallets:Object.keys(wallets).length,
    mempool:mempool.length,
    lastBlockTime:chain.length?chain[chain.length-1].time:null
  };
}

// ======== VÉRIF SIGNATURE ========

function verifySignature(tx){
  try{
    if(!tx.sig || !tx.pub) return false;
    const msgObj={
      type:tx.type,
      from:tx.from,
      to:tx.to??null,
      amount:tx.amount??0,
      token:tx.token??"POW",
      nonce:tx.nonce
    };
    const msg=new TextEncoder().encode(JSON.stringify(msgObj));
    const sig=b58dec(tx.sig);
    const pub=b58dec(tx.pub);
    return nacl.sign.detached.verify(msg,sig,pub);
  }catch(e){
    console.error("❌ Erreur verifySignature:",e.message);
    return false;
  }
}

// ======== APPLICATION DES TX ========

function applyTx(tx){
  const {type,from,to,amount,token,extra}=tx;
  const amt=Number(amount||0);

  if(!from) return {ok:false,reason:"from manquant"};

  const wFrom=ensureWallet(from,tx.pub);
  const wTo=to?ensureWallet(to):null;

  switch(type){
    case "MINT_POW":{
      // réservé à la trésorerie
      if(from!==treasury.addr) return {ok:false,reason:"mint réservé trésorerie"};
      wFrom.pow+=amt;
      return {ok:true};
    }
    case "MINT_USDC":{
      if(from!==treasury.addr) return {ok:false,reason:"mint réservé trésorerie"};
      wFrom.usdc+=amt;
      return {ok:true};
    }
    case "TRANSFER":{
      const cur=token==="USDC"?"usdc":"pow";
      if(wFrom[cur]<amt) return {ok:false,reason:"solde insuffisant"};
      wFrom[cur]-=amt;
      if(wTo) wTo[cur]+=amt;
      return {ok:true};
    }
    case "STAKE":{
      if(wFrom.pow<amt) return {ok:false,reason:"POW insuffisant"};
      wFrom.pow-=amt;
      wFrom.staked+=amt;
      return {ok:true};
    }
    case "UNSTAKE":{
      if(wFrom.staked<amt) return {ok:false,reason:"stake insuffisant"};
      wFrom.staked-=amt;
      wFrom.pow+=amt;
      return {ok:true};
    }
    case "LP_ADD":{
      if(wFrom.pow<amt || wFrom.usdc<extra.usdc) return {ok:false,reason:"fonds insuffisants"};
      wFrom.pow-=amt;
      wFrom.usdc-=extra.usdc;
      lpPool.pow+=amt;
      lpPool.usdc+=extra.usdc;
      // pas de jeton LP/NFT pour l’instant (démo)
      return {ok:true};
    }
    case "LP_REMOVE":{
      // pour la démo, on laisse la trésorerie seule à gérer LP
      if(from!==treasury.addr) return {ok:false,reason:"LP_REMOVE réservé trésorerie"};
      const share=Math.min(1,Number(extra.share)||0);
      const outPow=Math.floor(lpPool.pow*share);
      const outUsdc=Math.floor(lpPool.usdc*share);
      lpPool.pow-=outPow;
      lpPool.usdc-=outUsdc;
      wFrom.pow+=outPow;
      wFrom.usdc+=outUsdc;
      return {ok:true};
    }
    case "SWAP":{
      // AMM x*y=k sur lpPool
      if(lpPool.pow<=0||lpPool.usdc<=0) return {ok:false,reason:"LP vide"};
      const dir=token==="POW2USDC"?"POW2USDC":"USDC2POW";
      if(dir==="POW2USDC"){
        if(wFrom.pow<amt) return {ok:false,reason:"POW insuffisant"};
        // montant après fee
        const fee=Math.floor(amt*FEE_SWAP_BP/10000);
        const amtEff=amt-fee;
        const k=lpPool.pow*lpPool.usdc;
        const newPow=lpPool.pow+amtEff;
        const newUsdc=Math.floor(k/newPow);
        const out=lpPool.usdc-newUsdc;
        if(out<=0) return {ok:false,reason:"out<=0"};
        wFrom.pow-=amt;
        wFrom.usdc+=out;
        lpPool.pow=newPow;
        lpPool.usdc=newUsdc;
        wallets[treasury.addr].pow+=fee; // fee en POW
        return {ok:true,swapped:out};
      }else{
        if(wFrom.usdc<amt) return {ok:false,reason:"USDC insuffisant"};
        const fee=Math.floor(amt*FEE_SWAP_BP/10000);
        const amtEff=amt-fee;
        const k=lpPool.pow*lpPool.usdc;
        const newUsdc=lpPool.usdc+amtEff;
        const newPow=Math.floor(k/newUsdc);
        const out=lpPool.pow-newPow;
        if(out<=0) return {ok:false,reason:"out<=0"};
        wFrom.usdc-=amt;
        wFrom.pow+=out;
        lpPool.usdc=newUsdc;
        lpPool.pow=newPow;
        wallets[treasury.addr].usdc+=fee;
        return {ok:true,swapped:out};
      }
    }
    default:
      return {ok:false,reason:"type inconnu"};
  }
}

function processMempool(){
  if(!mempool.length) return;
  const txs=mempool.splice(0,mempool.length);
  const applied=[];
  for(const tx of txs){
    const res=applyTx(tx);
    if(res.ok) applied.push(tx);
    else console.log("❌ TX rejetée",tx.type,tx.from,"raison:",res.reason);
  }
  if(applied.length) addBlock(applied);
}

// ======== BOUCLE AUTO-BLOCK ========

setInterval(processMempool,BLOCK_TIME_MS);

// ======== WEBSOCKET ========

const wss=new WebSocket.Server({port:7001});
wss.on("connection",ws=>{
  console.log("🔌 Client WS connecté");
  ws.send(JSON.stringify({type:"hello",stats:getStats(),height}));
  ws.on("close",()=>console.log("🔌 Client WS déconnecté"));
});

function broadcast(obj){
  const msg=JSON.stringify(obj);
  wss.clients.forEach(c=>{
    if(c.readyState===WebSocket.OPEN) c.send(msg);
  });
}

// ======== API HTTP ========

// Ping simple
app.get("/ping",(req,res)=>{
  res.json({ok:true,stats:getStats()});
});

// Stats POWCHAIN
app.get("/stats",(req,res)=>{
  res.json(getStats());
});

// Chaîne complète
app.get("/chain",(req,res)=>{
  res.json(chain);
});

// Infos wallet
app.get("/wallet/:addr",(req,res)=>{
  const w=wallets[req.params.addr];
  if(!w) return res.status(404).json({error:"wallet inconnu"});
  res.json({addr:req.params.addr,...w});
});

// Soumission TX signée
app.post("/tx",(req,res)=>{
  const tx=req.body||{};
  try{
    if(!tx.type||!tx.from) return res.status(400).json({error:"type/from manquant"});
    const w=ensureWallet(tx.from,tx.pub);
    const expectedNonce=w.nonce+1;
    if(typeof tx.nonce!=="number"||tx.nonce!==expectedNonce){
      return res.status(400).json({error:"nonce invalide",expected:expectedNonce,got:tx.nonce});
    }
    if(!verifySignature(tx)){
      return res.status(400).json({error:"signature invalide"});
    }
    mempool.push(tx);
    w.nonce=tx.nonce;
    broadcast({type:"mempool",mempool:mempool.length});
    res.json({ok:true,queued:true,nonce:w.nonce});
  }catch(e){
    console.error("❌ Erreur /tx:",e);
    res.status(500).json({error:"server error"});
  }
});

// ======== BOOT ========

initTreasury();
addBlock([]); // genesis vide

const PORT=3000;
app.listen(PORT,"0.0.0.0",()=>{
  console.log("🔥 POWCHAIN en ligne sur port",PORT);
  console.log("curl http://127.0.0.1:"+PORT+"/stats");
});