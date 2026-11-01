import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from './server.js';
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
