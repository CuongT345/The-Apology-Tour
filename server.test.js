import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from './server.js';
test('live signaling is private to the performer and addressed viewer; live ends directly in voting',async()=>{
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 async function post(path,body,status=200){const r=await fetch(base+'/api/'+path,{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,status);return r.json();}
 try{
  const a=await post('create',{name:'Live host'}),code=a.state.code,A={code,token:a.token};
  const b=await post('join',{code,name:'Viewer'}),B={code,token:b.token};
  const c=await post('join',{code,name:'Other viewer'}),C={code,token:c.token};
  await post('action',{...A,action:'start'});const draw=await post('action',{...A,action:'draw'}),liveId=draw.state.liveId;
  assert.ok(liveId);
  const payload={kind:'description',description:{type:'offer',sdp:'v=0\r\n'}};
  await post('signal',{...A,liveId,to:b.state.you,payload});
  assert.deepEqual((await post('state',C)).signals,[]);
  const delivered=await post('state',B);assert.equal(delivered.signals.length,1);assert.equal(delivered.signals[0].from,a.state.you);assert.equal(delivered.signals[0].payload.description.type,'offer');
  assert.deepEqual((await post('state',B)).signals,[]);
  await post('signal',{...B,liveId,to:c.state.you,payload:{kind:'ready'}},403);
  await post('signal',{...B,liveId:'old',to:a.state.you,payload:{kind:'ready'}},409);
  await post('signal',{...B,liveId,to:a.state.you,payload},403);
  const started=await post('action',{...A,action:'record',live:true,video:true});assert.equal(started.state.liveMode,true);assert.equal(started.state.videoMode,false);
  const ended=await post('action',{...A,action:'stop'});assert.equal(ended.state.phase,'verdict');assert.equal(ended.state.clip,null);
  await post('signal',{...B,liveId,to:a.state.you,payload:{kind:'ready'}},409);
  await post('action',{...B,action:'vote',vote:'good',twist:true});
 }finally{await new Promise(r=>server.close(r));}
});
test('recorded videos are private until shared, require viewing, and expire on next turn',async()=>{
  const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function post(path,body,status=200){const r=await fetch(base+'/api/'+path,{method:'POST',body:JSON.stringify(body)});assert.equal(r.status,status);return r.json();}
  try{
    const a=await post('create',{name:'Creator'}),code=a.state.code,A={code,token:a.token};
    const b=await post('join',{code,name:'Judge'}),B={code,token:b.token};
    const headers=p=>({Authorization:'Bearer '+p.token,'X-Room':code,'Content-Type':'video/webm'});
    const clip=Buffer.concat([Buffer.from([0x1a,0x45,0xdf,0xa3]),Buffer.alloc(64)]);
    for(const action of ['start','draw'])await post('action',{...A,action});
    await post('action',{...A,action:'record',video:true});
    await post('action',{...B,action:'react',reaction:'fire'});
    const reaction=await post('state',A);assert.equal(reaction.state.reactions.fire,1);
    await post('action',{...B,action:'react',reaction:'fire'},429);
    await post('action',{...A,action:'react',reaction:'fire'},403);
    await post('action',{...A,action:'stop'});
    await post('action',{...A,action:'publish'},400);
    assert.equal((await fetch(base+'/api/clip',{method:'POST',headers:headers(B),body:clip})).status,403);
    assert.equal((await fetch(base+'/api/clip',{method:'POST',headers:headers(A),body:Buffer.alloc(64)})).status,415);
    const upload=await fetch(base+'/api/clip',{method:'POST',headers:headers(A),body:clip});assert.equal(upload.status,200);
    const ready=await upload.json();assert.ok(ready.state.clip.id);assert.equal(ready.state.phase,'review');
    assert.equal((await post('state',B)).state.clip,null);
    assert.equal((await fetch(base+'/api/clip',{headers:headers(B)})).status,403);
    assert.equal((await fetch(base+'/api/clip',{headers:{'X-Room':code}})).status,401);
    await post('action',{...A,action:'publish'});
    const video=await fetch(base+'/api/clip',{headers:headers(B)});assert.equal(video.status,200);assert.equal(video.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await video.arrayBuffer()),clip);
    await post('action',{...B,action:'vote',vote:'good',twist:true},409);
    await post('action',{...B,action:'watched',clipId:'stale'},409);
    await post('action',{...B,action:'watched',clipId:ready.state.clip.id});
    await post('action',{...B,action:'vote',vote:'good',twist:true});
    await post('action',{...A,action:'next'});
    assert.equal((await fetch(base+'/api/clip',{headers:headers(B)})).status,404);
    for(const action of ['draw','record','stop'])await post('action',{...B,action,video:true});
    await post('action',{...B,action:'retake'});assert.equal((await post('state',B)).state.phase,'draw');
  }finally{await new Promise(r=>server.close(r));}
});
test('two independent players complete a tour with private votes and synchronized scores',async()=>{
  const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function post(path,body,status=200){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status);return r.json();}
  try{
    const a=await post('create',{name:'Alice'}),code=a.state.code;
    const b=await post('join',{name:'Bob',code});
    const A={code,token:a.token},B={code,token:b.token};
    assert.notEqual(a.token,b.token);
    assert.equal(JSON.stringify(b.state).includes(a.token),false);
    await post('action',{...B,action:'start'},403);
    await post('action',{...A,action:'start',rounds:1,seconds:45});
    await post('join',{code,name:'Late'},400);
    await post('action',{...B,action:'draw'},403);
    await post('action',{...A,action:'draw'});
    await post('action',{...A,action:'record'});
    await post('action',{...A,action:'stop'});
    await post('action',{...A,action:'vote',vote:'good',twist:true},403);
    const result=await post('action',{...B,action:'vote',vote:'good',twist:true});
    assert.equal(result.state.players[0].subs,1225000);
    const observed=await post('state',A);
    assert.deepEqual(observed.state.players,result.state.players);
    assert.equal(observed.state.myVote,null);
    assert.equal('votes' in observed.state,false);
    assert.equal(observed.state.result.bonus,true);
    await post('action',{...B,action:'vote',vote:'bad',twist:false},409);
    await post('action',{...A,action:'next'});
    await post('action',{...B,action:'draw'});
    await post('action',{...B,action:'record'});
    await post('action',{...B,action:'stop'});
    const bob=await post('action',{...A,action:'vote',vote:'bad',twist:false});
    assert.equal(bob.state.players[1].subs,900000);
    const end=await post('action',{...A,action:'next'});assert.equal(end.state.phase,'end');
    const again=await post('action',{...A,action:'again'});assert.equal(again.state.phase,'lobby');assert.equal(again.state.players[0].subs,1000000);
    await post('state',{code,token:'wrong'},401);
    const home=await fetch(base);assert.equal(home.status,200);assert.match(await home.text(),/The Apology Tour/);
  }finally{await new Promise(r=>server.close(r));}
});
test('votes remain private while another judge has not voted',async()=>{
  const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  async function post(path,b){const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/'+path,{method:'POST',body:JSON.stringify(b)});assert.equal(r.status,200);return r.json();}
  try{const a=await post('create',{name:'Host'}),code=a.state.code,A={code,token:a.token};const b=await post('join',{code,name:'Judge1'}),B={code,token:b.token};const c=await post('join',{code,name:'Judge2'}),C={code,token:c.token};
    for(const action of ['start','draw','record','stop'])await post('action',{...A,action});
    await post('action',{...B,action:'vote',vote:'bad',twist:true});
    for(const p of [A,C]){const x=await post('state',p);assert.equal(x.state.phase,'verdict');assert.equal(x.state.myVote,null);assert.equal(x.state.result,null);assert.equal(JSON.stringify(x.state).includes('"bad"'),false);}
    const x=await post('state',B);assert.deepEqual(x.state.myVote,{vote:'bad',twist:true});
    await post('action',{...C,action:'vote',vote:'good',twist:false});const y=await post('state',A);assert.equal(y.state.delta,50000);assert.equal(y.state.result.bonus,false);
  }finally{await new Promise(r=>server.close(r));}
});
