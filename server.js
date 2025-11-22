// POWCHAIN — Server vC (Validator + API + WS + LP + Swap + Treasury Auto)
const express=require("express"),bodyParser=require("body-parser"),WebSocket=require("ws"),nacl=require("tweetnacl"),bs58=require("bs58");
const app=express();app.use(bodyParser.json());
const DEC=1e6;
const chain=[];      // {height,time,hash,txs,validator}
const wallets={};    // addr -> {pow,usdc,staked,nonce,pub}
const treasury={};   // will be assigned later
let lpPow=0,lpUsdc=0,height=0;

// ---- generate treasury wallet ----
(function(){
  const kp=nacl.sign.keyPair();
  const addr=bs58.encode(kp.publicKey);
  const priv=bs58.encode(kp.secretKey);
  treasury.addr=addr;
  treasury.priv=priv;
  wallets[addr]={pow:0,usdc:0,staked:0,nonce:0,pub:addr};
  console.log("🆕 Trésorerie POWCHAIN:",addr);
})();

// ---- hashing utility ----
function sha(o){return require("crypto").createHash("sha256").update(JSON.stringify(o)).digest("hex")}

// ---- apply TX ----
function applyTx(t){
  const w=wallets[t.from]; if(!w) return false;
  if(w.nonce+1!==t.nonce) return false;
  const msg=new TextEncoder().encode(JSON.stringify({type:t.type,from:t.from,to:t.to??null,amount:t.amount??null,token:t.token??null,nonce:t.nonce}));
  const sig=bs58.decode(t.sig),pub=bs58.decode(w.pub);
  if(!nacl.sign.detached.verify(msg,sig,pub)) return false;
  w.nonce++;
  if(t.type==="TX_POW"){
    const b=wallets[t.to]??(wallets[t.to]={pow:0,usdc:0,staked:0,nonce:0,pub:t.to});
    if(w.pow<t.amount) return false;
    w.pow-=t.amount;b.pow+=t.amount;return true;
  }
  if(t.type==="STAKE"){
    if(w.pow<t.amount) return false;
    w.pow-=t.amount;w.staked+=t.amount;return true;
  }
  if(t.type==="SWAP"){
    if(t.token==="pow2usdc"){ // POW → USDC
      if(w.pow<t.amount) return false;
      const out = lpPow && lpUsdc ? Math.floor((t.amount*lpUsdc)/lpPow) : 0;
      if(out<=0) return false;
      w.pow-=t.amount; w.usdc+=out; lpPow+=t.amount; lpUsdc-=out; return true;
    }
    if(t.token==="usdc2pow"){ // USDC → POW
      if(w.usdc<t.amount) return false;
      const out = lpPow && lpUsdc ? Math.floor((t.amount*lpPow)/lpUsdc) : 0;
      if(out<=0) return false;
      w.usdc-=t.amount; w.pow+=out; lpUsdc+=t.amount; lpPow-=out; return true;
    }
  }
  if(t.type==="LP_ADD"){
    if(w.pow<t.pow||w.usdc<t.usdc) return false;
    w.pow-=t.pow; w.usdc-=t.usdc; lpPow+=t.pow; lpUsdc+=t.usdc; return true;
  }
  return false;
}

// ---- block production ----
function produceBlock(txList,validator){
  height++;
  const block={height,time:Date.now(),txs:txList,validator};
  block.hash=sha(block);
  chain.push(block);
  return block;
}

// ---- WebSocket ----
const wss=new WebSocket.Server({port:7001});
wss.on("connection",ws=>{
  ws.on("message",data=>{
    let tx;try{tx=JSON.parse(data.toString())}catch{return;}
    if(!wallets[tx.from]) return;
    if(applyTx(tx)){
      const b=produceBlock([tx],tx.from);
      broadcast(JSON.stringify({type:"block",block:b}));
      console.log("⛓ Bloc #"+b.height,"TX:",tx.type);
    }
  });
});
function broadcast(m){wss.clients.forEach(c=>c.readyState===1&&c.send(m))}

// ---- API ----
app.get("/stats",(req,res)=>res.json({
  height,lpPow,lpUsdc,
  treasuryUsdc:wallets[treasury.addr].usdc/DEC,
  treasurySol:0
}));
app.get("/wallet/:addr",(req,res)=>{
  const a=req.params.addr;
  const w=wallets[a]??{pow:0,usdc:0,staked:0,nonce:0,pub:a};
  wallets[a]=w;res.json(w);
});
app.get("/block/:h",(req,res)=>{
  const b=chain.find(x=>x.height==req.params.h);
  if(!b) return res.status(404).json({error:"not found"});
  res.json(b);
});
app.get("/",(req,res)=>res.sendFile(require("path").join(__dirname,"client.html")));

app.listen(3000,()=>console.log("🚀 POWCHAIN API http://localhost:3000"));
console.log("🔌 WebSocket ws://localhost:7001");
console.log("🏦 Trésorerie:",treasury.addr);
