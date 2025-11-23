const express = require("express");
const app = express();
app.use(express.json());
app.use(express.static(__dirname + "/client"));

let block = 1;
let mempool = [];
let totalSupply = 1000000;
let lpTvl = 0;
let balances = {}; // {addr:{pow,usd,staked}}

function ensureWallet(a){
  if(!balances[a]) balances[a] = {pow:0,usd:0,staked:0};
}

setInterval(()=>{ if(mempool.length>=1){
  mempool = [];
  block++;
}},5000);

app.get("/state",(req,res)=>{
  res.json({block,mempool,totalSupply,lpTvl,balances});
});

app.post("/tx",(req,res)=>{
  let tx = req.body;
  ensureWallet(tx.from);

  if(tx.type === "swap"){
    if(tx.pair === "POWtoUSD"){
      if(balances[tx.from].pow < tx.amount) return res.json({err:"No POW"});
      balances[tx.from].pow -= tx.amount;
      balances[tx.from].usd += tx.amount;
    }
    if(tx.pair === "USDtoPOW"){
      if(balances[tx.from].usd < tx.amount) return res.json({err:"No USD"});
      balances[tx.from].usd -= tx.amount;
      balances[tx.from].pow += tx.amount;
    }
  }

  if(tx.type === "stake"){
    if(balances[tx.from].pow < tx.amount) return res.json({err:"No POW"});
    balances[tx.from].pow -= tx.amount;
    balances[tx.from].staked += tx.amount;
  }

  if(tx.type === "unstake"){
    balances[tx.from].pow += balances[tx.from].staked;
    balances[tx.from].staked = 0;
  }

  if(tx.type === "addLP"){
    balances[tx.from].pow -= tx.pow;
    balances[tx.from].usd -= tx.usd;
    lpTvl += tx.pow + tx.usd;
  }

  if(tx.type === "remLP"){
    balances[tx.from].pow += 10;
    balances[tx.from].usd += 10;
    lpTvl -= 20;
  }

  mempool.push(tx);
  return res.json({ok:true});
});

app.listen(3000, ()=> console.log("POWCHAIN server running on port 3000"));