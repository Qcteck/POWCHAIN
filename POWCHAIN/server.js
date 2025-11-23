const http=require("http");
const WebSocket=require("ws");

let height=0;
let chain=[];
let wallets={};
let lpPow=0,lpUsdc=0;
let treasuryAddr="BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy";
let treasuryUsdc=0,treasurySol=0;

function getWallet(a){
  if(!wallets[a])wallets[a]={pow:0,usdc:0,staked:0,nonce:0};
  return wallets[a];
}

function applyTx(tx){
  const w=getWallet(tx.from);
  if(tx.nonce!==w.nonce+1)return false;
  if(tx.type==="SWAP"){
    if(tx.token==="pow2usdc"){
      if(w.pow<tx.amount)return false;
      let usdc=(lpUsdc*tx.amount)/lpPow;
      w.pow-=tx.amount;w.usdc+=usdc;
      lpPow+=tx.amount;lpUsdc-=usdc;
    }
    if(tx.token==="usdc2pow"){
      if(w.usdc<tx.amount)return false;
      let pow=(lpPow*tx.amount)/lpUsdc;
      w.usdc-=tx.amount;w.pow+=pow;
      lpUsdc+=tx.amount;lpPow-=pow;
    }
  }
  if(tx.type==="LP_ADD"){
    const w=getWallet(tx.from);
    if(w.pow<tx.pow||w.usdc<tx.usdc)return false;
    w.pow-=tx.pow;w.usdc-=tx.usdc;
    lpPow+=tx.pow;lpUsdc+=tx.usdc;
  }
  if(tx.type==="BRIDGE_IN"){
    const w=getWallet(tx.from);
    w.usdc+=tx.amount;
    treasurySol+=tx.sol||0;
  }
  w.nonce++;
  return true;
}

function mineBlock(txs){
  height++;
  const b={height,time:Date.now(),txs};
  b.hash=require("crypto").randomBytes(16).toString("hex");
  chain.push(b);
  broadcast({type:"block",height});
  if(chain.length>500)chain.shift();
}

setInterval(()=>mineBlock([]),8000);

const server=http.createServer((req,res)=>{
  res.setHeader("Content-Type","application/json");
  const url=req.url.split("/");
  if(url[1]==="stats"){
    res.end(JSON.stringify({
      height,lpPow,lpUsdc,
      treasuryAddr,treasuryUsdc,treasurySol
    }));
  } else if(url[1]==="wallet"){
    const w=getWallet(url[2]||"");
    res.end(JSON.stringify(w));
  } else if(url[1]==="block"){
    const h=parseInt(url[2]);
    const b=chain.find(x=>x.height===h)||{};
    res.end(JSON.stringify(b));
  } else if(url[1]==="tx" && req.method==="POST"){
    let body=""; req.on("data",d=>body+=d);
    req.on("end",()=>{
      try{
        const tx=JSON.parse(body);
        if(applyTx(tx)){
          mineBlock([tx]);
          res.end(JSON.stringify({ok:true}));
        } else {
          res.statusCode=400;
          res.end(JSON.stringify({ok:false}));
        }
      }catch(e){
        res.statusCode=500;res.end(JSON.stringify({err:e.message}));
      }
    });
  } else {
    res.end(JSON.stringify({ok:true,service:"powchain"}));
  }
});

const wss=new WebSocket.Server({server});
function broadcast(msg){
  const str=JSON.stringify(msg);
  wss.clients.forEach(c=>c.readyState===1&&c.send(str));
}
wss.on("connection",ws=>{
  ws.send(JSON.stringify({type:"hello",treasury:treasuryAddr}));
});

server.listen(3000,()=>console.log("POWCHAIN node online port 3000"));