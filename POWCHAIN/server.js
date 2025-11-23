// ====================== POWCHAIN SERVER FULL ==========================
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

const PORT = 3000;
const DEC = 1e6;
const DB = "powchain.json";

// database init
let state = fs.existsSync(DB)
  ? JSON.parse(fs.readFileSync(DB,"utf8"))
  : {
      treasury: "BZJsWeJizv3YeyuWjF5187jrcduPFAHWjqL7jgq4kGwy",
      height: 0,
      wallets: {},
      lpPow: 0,
      lpUsdc: 0,
      treasuryUsdc: 0,
      treasurySol: 0,
      blocks: [],
      mempool: []
    };

function save(){ fs.writeFileSync(DB, JSON.stringify(state)); }
function getW(a){
  if(!state.wallets[a]) state.wallets[a] = { pow:0, usdc:0, staked:0, nonce:0 };
  return state.wallets[a];
}

function applyTx(tx){
  const w = getW(tx.from);
  if(tx.nonce !== w.nonce + 1) return false;

  if(tx.type==="LP_ADD"){
    if(w.pow < tx.pow || w.usdc < tx.usdc) return false;
    w.pow -= tx.pow; w.usdc -= tx.usdc;
    state.lpPow += tx.pow; state.lpUsdc += tx.usdc;
  }
  if(tx.type==="SWAP"){
    if(tx.token==="pow2usdc"){
      const pow = tx.amount, usdc = (pow * state.lpUsdc / state.lpPow)|0;
      if(w.pow < pow) return false;
      w.pow -= pow; w.usdc += usdc;
      state.lpPow += pow; state.lpUsdc -= usdc;
    }
    if(tx.token==="usdc2pow"){
      const usdc = tx.amount, pow = (usdc * state.lpPow / state.lpUsdc)|0;
      if(w.usdc < usdc) return false;
      w.usdc -= usdc; w.pow += pow;
      state.lpUsdc += usdc; state.lpPow -= pow;
    }
  }

  w.nonce++;
  return true;
}

// mining every 5 tx
function mineBlock(){
  if(state.mempool.length < 5) return;
  const txs = state.mempool.splice(0,5);
  state.height++;
  const hash = "B"+Math.random().toString(36).slice(2);
  const blk = { height: state.height, time: Date.now(), txs, hash, validator:"SYSTEM" };
  state.blocks.push(blk);
  save();
  broadcast({ type:"block", height: state.height });
}

// HTTP server (API + static)
const server = http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");

  if(req.method==="GET" && req.url.startsWith("/stats")){
    return sendJSON(res,{
      height: state.height,
      lpPow: state.lpPow,
      lpUsdc: state.lpUsdc,
      treasuryUsdc: state.treasuryUsdc,
      treasurySol: state.treasurySol,
      treasuryAddr: state.treasury
    });
  }

  if(req.method==="GET" && req.url.startsWith("/wallet/")){
    const a = decodeURIComponent(req.url.split("/")[2]);
    const w = getW(a);
    return sendJSON(res,w);
  }

  if(req.method==="GET" && req.url.startsWith("/block/")){
    const h = parseInt(req.url.split("/")[2]||0);
    const b = state.blocks.find(x=>x.height===h);
    return sendJSON(res,b||{error:"NOT_FOUND"});
  }

  if(req.method==="POST" && req.url==="/tx"){
    collectBody(req,body=>{
      try{
        const tx = JSON.parse(body);
        const w = getW(tx.from);
        const msg = JSON.stringify({
          type:tx.type,from:tx.from,to:tx.to??null,amount:tx.amount??null,token:tx.token??null,nonce:tx.nonce
        });
        const ok = nacl.sign.detached.verify(
          Buffer.from(msg),
          bs58.decode(tx.sig),
          bs58.decode(tx.pub)
        );
        if(!ok) return sendJSON(res,{error:"SIG_FAIL"});
        if(!applyTx(tx)) return sendJSON(res,{error:"APPLY_FAIL"});
        state.mempool.push(tx);
        save();
        mineBlock();
        broadcast({ type:"tx" });
        return sendJSON(res,{ok:true});
      }catch(e){ return sendJSON(res,{error:e.message}); }
    });
    return;
  }

  // static client
  if(req.url==="/"||req.url==="/client"||req.url==="/client/") return redirect(res,"/client/index.html");
  if(req.url.startsWith("/client/")){
    const path = "." + req.url;
    if(fs.existsSync(path)) return fs.createReadStream(path).pipe(res);
    return send404(res);
  }

  send404(res);
});

function redirect(res,to){
  res.writeHead(302,{Location:to}); res.end();
}
function sendJSON(res,obj){
  res.writeHead(200,{"Content-Type":"application/json"}); res.end(JSON.stringify(obj));
}
function send404(res){
  res.writeHead(404,{"Content-Type":"text/plain"}); res.end("404");
}
function collectBody(req,cb){ let d=""; req.on("data",c=>d+=c); req.on("end",()=>cb(d)); }

// WS
const wss = new WebSocket.Server({server});
const peers = [];
wss.on("connection",ws=>{
  peers.push(ws);
  ws.send(JSON.stringify({type:"hello",treasury:state.treasury}));
  ws.on("close",()=>peers.splice(peers.indexOf(ws),1));
});
function broadcast(o){
  const m = JSON.stringify(o);
  peers.forEach(ws=>{ try{ws.send(m)}catch{} });
}

server.listen(PORT,()=>console.log("POWCHAIN server running on port",PORT));