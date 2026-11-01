import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SCANDALS,TWISTS} from './cards.js';

const rooms=new Map();
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const token=()=>randomBytes(24).toString('hex');
function view(r,p){
  return {code:r.code,host:r.host,you:p.id,phase:r.phase,round:r.round,rounds:r.rounds,seconds:r.seconds,turn:r.turn,card:r.card,twist:r.twist,deadline:r.deadline,delta:r.delta,
    players:r.players.map(({id,name,av,subs,seen})=>({id,name,av,subs,online:Date.now()-seen<15000})),
    voted:Object.keys(r.votes),myVote:r.votes[p.id]??null,
    result:r.phase==='board'||r.phase==='end'?r.result:null};
}
function draw(r){r.card=SCANDALS[randomInt(SCANDALS.length)];r.twist=TWISTS[randomInt(TWISTS.length)];}
function finish(r){r.phase='verdict';r.votes={};r.deadline=null;}
function act(r,p,b){
  const active=r.players[r.turn];
  const host=()=>{if(p.id!==r.host)fail('Only the host can do that.',403);};
  const performer=()=>{if(p.id!==active?.id)fail('It is another creator’s turn.',403);};
  const phase=(s)=>{if(r.phase!==s)fail('The game has moved on. Refresh and try again.',409);};
  switch(b.action){
    case 'start': host();phase('lobby');if(r.players.length<2)fail('At least two creators must join.');
      r.rounds=[1,2,3].includes(b.rounds)?b.rounds:2;r.seconds=[45,60,90].includes(b.seconds)?b.seconds:60;r.phase='pass';break;
    case 'draw':performer();phase('pass');draw(r);r.phase='draw';break;
    case 'redraw':performer();phase('draw');active.subs-=50000;draw(r);break;
    case 'record':performer();phase('draw');r.phase='record';r.deadline=Date.now()+r.seconds*1000;break;
    case 'stop':performer();phase('record');finish(r);break;
    case 'vote':phase('verdict');if(p.id===active.id)fail('Creators cannot vote for themselves.',403);
      if(r.votes[p.id])fail('Your private vote is already locked.',409);
      if(!['good','meh','bad'].includes(b.vote)||typeof b.twist!=='boolean')fail('Choose a verdict and twist vote.');
      r.votes[p.id]={vote:b.vote,twist:b.twist};
      if(Object.keys(r.votes).length===r.players.length-1){
        const votes=Object.values(r.votes),bonus=votes.filter(v=>v.twist).length>votes.length/2;
        r.delta=votes.reduce((sum,v)=>sum+({good:150000,meh:25000,bad:-100000}[v.vote]),0)+(bonus?75000:0);
        active.subs+=r.delta;r.result={good:votes.filter(v=>v.vote==='good').length,meh:votes.filter(v=>v.vote==='meh').length,bad:votes.filter(v=>v.vote==='bad').length,bonus};r.phase='board';
      }break;
    case 'next':host();phase('board');r.turn++;if(r.turn===r.players.length){r.turn=0;r.round++;}
      r.phase=r.round>r.rounds?'end':'pass';r.votes={};break;
    case 'again':host();phase('end');r.players.forEach(x=>x.subs=1000000);r.round=1;r.turn=0;r.votes={};r.phase='lobby';break;
    default:fail('Unknown action.');
  }
}
export function createGameServer(){
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/health'){res.end('ok');return;}
      if(url.pathname.startsWith('/api/')){
        res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
        if(req.method!=='POST')fail('Use POST.',405);
        if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)fail('Invalid origin.',403);
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)fail('Request too large.',413);}
        let b;try{b=JSON.parse(raw);}catch{fail('Invalid JSON.');}
        let r,p;
        if(url.pathname==='/api/create'||url.pathname==='/api/join'){
          const name=typeof b.name==='string'?b.name.trim().slice(0,18):'';if(!name)fail('Enter your creator name.');
          // Avatar values are allowlisted, since the client draws SVG from these values.
          const av={};const allowed={mood:['sad','crying','smug','shocked','fake'],skin:['#f6d7bd','#ecbc93','#d39a6a','#a8714a','#7a4c30','#4e3020'],hair:['short','long','curly','bun','mohawk','bald'],hairColor:['#1f1a17','#5a3825','#b5793f','#e6c36a','#d9d4cc','#e2557b','#4f8fe0','#6ad18f'],outfit:['hoodie','tee','blazer','turtleneck'],outfitColor:['#8a919c','#3a3f4a','#f2efe6','#c84b4b','#3f7a5a','#d9a441','#6d5bd0'],extra:['none','glasses','shades','beanie','cap','headphones'],bg:['#ffd84d','#8fd3c1','#f4a6a6','#a9b8ff','#c9c2b3','#f7a35c']};
          for(const [k,opts]of Object.entries(allowed))av[k]=opts.includes(b.av?.[k])?b.av[k]:opts[0];
          p={id:randomBytes(8).toString('hex'),token:token(),name,av,subs:1000000,seen:Date.now()};
          if(url.pathname==='/api/create'){
            if(rooms.size>=1000)fail('Server is full. Try again later.',503);
            let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
            r={code,host:p.id,players:[],phase:'lobby',round:1,rounds:2,seconds:60,turn:0,votes:{},updated:Date.now()};rooms.set(code,r);
          }else{r=rooms.get(String(b.code).toUpperCase());if(!r)fail('Room not found. Check the code, or create a new room.',404);if(r.phase!=='lobby')fail('This tour has already started.');if(r.players.length>=8)fail('This room is full.');}
          r.players.push(p);
        }else{
          r=rooms.get(String(b.code).toUpperCase());if(!r)fail('Room expired. Create a new room.',404);
          p=r.players.find(p=>p.token===b.token);if(!p)fail('Invalid player session.',401);
          if(r.phase==='record'&&Date.now()>=r.deadline)finish(r);
          if(url.pathname==='/api/action')act(r,p,b);else if(url.pathname!=='/api/state')fail('Not found.',404);
        }
        p.seen=Date.now();r.updated=Date.now();res.end(JSON.stringify({token:p.token,state:view(r,p)}));return;
      }
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/assets.js':['assets.js','text/javascript'],'/style.css':['style.css','text/css']};
      const file=files[url.pathname];if(!file)fail('Not found.',404);
      res.setHeader('Content-Type',file[1]+'; charset=utf-8');res.end(await readFile(new URL('./public/'+file[0],import.meta.url)));
    }catch(e){res.statusCode=e.status||500;res.end(JSON.stringify({error:e.status?e.message:'Server error.'}));}
  });
}
const sweep=setInterval(()=>{for(const[c,r]of rooms)if(Date.now()-r.updated>6*60*60*1000)rooms.delete(c);},60000);sweep.unref();
if(process.argv[1]===fileURLToPath(import.meta.url))createGameServer().listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('The Apology Tour: http://localhost:'+(process.env.PORT||3000)));
