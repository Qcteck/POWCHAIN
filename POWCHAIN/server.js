const express=require("express");
const path=require("path");
const app=express();
app.use(express.json());

// --- ÉTAT EN MÉMOIRE --- //
let wallets=[];          // {pub,pow,usdc}
let mempool=[];          // tx en attente
let chain=[];            // blocs minés
let pendingStake={};     // pub -> montant staké
let pool={pow:1000,usdc:1000}; // LP initial POW/USDC POW

function ensureWallet(pub){
  let w=wallets.find(x=>x.pub===pub);
  if(!w){w={pub,pow:0,usdc:0};wallets.push(w);}
  return w;
}

// --- MINAGE SIMPLE --- //
function newBlock(){
  const txs=[...mempool];
  mempool.length=0;
  let rewards=[];
  for(const pub in pendingStake){
    const reward=pendingStake[pub]*0.05;
    if(reward>0) rewards.push({from:"STAKE",to:pub,amount:reward});
    const w=ensureWallet(pub);
    w.pow+=reward;
  }
  chain.push({
    index:chain.length,
    txs,
    rewards,
    pool:{pow:pool.pow,usdc:pool.usdc},
    timestamp:Date.now()
  });
}

// --- WALLET / SOLDE --- //
app.post("/wallet",(req,res)=>{
  const {pub}=req.body;
  if(!pub) return res.json({ok:false,msg:"pub manquant"});
  ensureWallet(pub);
  res.json({ok:true});
});

app.get("/balance/:pub",(req,res)=>{
  const w=ensureWallet(req.params.pub);
  res.json({pub:w.pub,pow:w.pow,usdc:w.usdc});
});

// --- FAUCET TEST (POW + USDC) --- //
app.get("/faucet/:pub",(req,res)=>{
  const w=ensureWallet(req.params.pub);
  w.pow+=100;
  w.usdc+=100;
  res.json({ok:true,msg:"FAUCET +100 POW +100 USDC",pow:w.pow,usdc:w.usdc});
});

// --- ENVOI POW (simple) --- //
app.get("/send/:from/:to/:amount",(req,res)=>{
  const amount=parseFloat(req.params.amount)||0;
  if(amount<=0) return res.json({ok:false,msg:"amount invalide"});
  const from=ensureWallet(req.params.from);
  const to=ensureWallet(req.params.to);
  if(from.pow<amount) return res.json({ok:false,msg:"solde insuffisant"});
  from.pow-=amount;
  to.pow+=amount;
  mempool.push({from:from.pub,to:to.pub,amount});
  if(mempool.length>=2) newBlock();
  res.json({ok:true,from:from.pub,to:to.pub,amount});
});

// --- STAKING POW --- //
app.get("/stake/:pub/:amount",(req,res)=>{
  const amount=parseFloat(req.params.amount)||0;
  if(amount<=0) return res.json({ok:false,msg:"amount invalide"});
  const w=ensureWallet(req.params.pub);
  if(w.pow<amount) return res.json({ok:false,msg:"solde insuffisant"});
  w.pow-=amount;
  pendingStake[w.pub]=(pendingStake[w.pub]||0)+amount;
  res.json({ok:true,staked:pendingStake[w.pub]});
});

app.get("/stakes",(req,res)=>res.json(pendingStake));

// --- LP POW / USDC (AMM x*y=k) --- //
function swapPowToUsdc(amountIn){
  const fee=amountIn*0.003;
  const net=amountIn-fee;
  const k=pool.pow*pool.usdc;
  const powAfter=pool.pow+net;
  const usdcAfter=k/powAfter;
  const out=pool.usdc-usdcAfter;
  pool.pow=powAfter;
  pool.usdc=usdcAfter;
  return {out,fee};
}

function swapUsdcToPow(amountIn){
  const fee=amountIn*0.003;
  const net=amountIn-fee;
  const k=pool.pow*pool.usdc;
  const usdcAfter=pool.usdc+net;
  const powAfter=k/usdcAfter;
  const out=pool.pow-powAfter;
  pool.usdc=usdcAfter;
  pool.pow=powAfter;
  return {out,fee};
}

app.get("/lp",(req,res)=>{
  res.json({pool,k:pool.pow*pool.usdc});
});

app.get("/swap/pow-usdc/:pub/:amount",(req,res)=>{
  const amount=parseFloat(req.params.amount)||0;
  if(amount<=0) return res.json({ok:false,msg:"amount invalide"});
  const w=ensureWallet(req.params.pub);
  if(w.pow<amount) return res.json({ok:false,msg:"solde POW insuffisant"});
  const {out,fee}=swapPowToUsdc(amount);
  if(out<=0) return res.json({ok:false,msg:"swap impossible"});
  w.pow-=amount;
  w.usdc+=out;
  mempool.push({from:w.pub,to:"LP_POW_USDC",amount});
  if(mempool.length>=2) newBlock();
  res.json({ok:true,side:"POW->USDC",spent:amount,fee,received:out,pow:w.pow,usdc:w.usdc,pool});
});

app.get("/swap/usdc-pow/:pub/:amount",(req,res)=>{
  const amount=parseFloat(req.params.amount)||0;
  if(amount<=0) return res.json({ok:false,msg:"amount invalide"});
  const w=ensureWallet(req.params.pub);
  if(w.usdc<amount) return res.json({ok:false,msg:"solde USDC insuffisant"});
  const {out,fee}=swapUsdcToPow(amount);
  if(out<=0) return res.json({ok:false,msg:"swap impossible"});
  w.usdc-=amount;
  w.pow+=out;
  mempool.push({from:w.pub,to:"LP_USDC_POW",amount});
  if(mempool.length>=2) newBlock();
  res.json({ok:true,side:"USDC->POW",spent:amount,fee,received:out,pow:w.pow,usdc:w.usdc,pool});
});

// --- EXPLORER --- //
app.get("/mempool",(req,res)=>res.json(mempool));
app.get("/blocks",(req,res)=>res.json(chain));

// --- CLIENT STATIC --- //
app.use("/client",express.static(path.join(__dirname,"client")));
app.get("/",(req,res)=>res.redirect("/client/index.html"));

const PORT=3000;
app.listen(PORT,()=>console.log("POWCHAIN v2 + LP running on port "+PORT));