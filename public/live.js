// One-way WebRTC broadcast: creator camera/mic -> every audience member.
// Signaling is authenticated by the game server; media goes directly peer-to-peer.
const live = { id: '', peers: new Map(), remote: null, video: null, selfVideo: null, queue: Promise.resolve(), error: '', readyAt: 0, starting: false };
Object.assign(live,{soundWanted:false,audioContext:null,audioSource:null,audioGain:null,audioAnalyser:null,audioTrackId:'',audioLevel:0,audioBytes:0,audioEnergy:0});
function disconnectAudio(){live.audioSource?.disconnect();live.audioGain?.disconnect();live.audioAnalyser?.disconnect();live.audioSource=null;live.audioGain=null;live.audioAnalyser=null;live.audioTrackId='';live.audioLevel=0;}
function routeLiveAudio(){
  const track=live.remote?.getAudioTracks().find(t=>t.readyState==='live');
  if(!track||!live.audioContext||!live.soundWanted)return;
  if(live.audioTrackId!==track.id){
    disconnectAudio();live.audioTrackId=track.id;
    live.audioSource=live.audioContext.createMediaStreamSource(new MediaStream([track]));
    live.audioGain=live.audioContext.createGain();live.audioGain.gain.value=1;
    live.audioAnalyser=live.audioContext.createAnalyser();live.audioAnalyser.fftSize=256;
    live.audioSource.connect(live.audioGain);live.audioGain.connect(live.audioAnalyser);live.audioAnalyser.connect(live.audioContext.destination);
  }
}
async function enableLiveSound(){
  live.soundWanted=true;
  live.audioContext??=new (window.AudioContext||window.webkitAudioContext)();
  await live.audioContext.resume();routeLiveAudio();
}
const liveBaseAccept = accept, liveBaseRender = render;
const liveActive = () => state?.liveId && ['draw', 'record'].includes(state.phase);
const isCreator = () => state?.players[state.turn]?.id === state?.you;
const liveSignal = async (to, payload) => {
  if (!liveActive()) return;
  const data = await api('signal', { ...session, to, liveId: state.liveId, payload });
  accept(data);
};
function closeLive() {
  disconnectAudio();live.audioBytes=0;live.audioEnergy=0;
  for (const { pc } of live.peers.values()) pc.close();
  live.peers.clear();live.remote = null;live.video?.remove();live.video = null;
  live.selfVideo?.remove();live.selfVideo = null;live.error = '';live.readyAt = 0;
}
function dropPeer(id) { const peer = live.peers.get(id); peer?.pc.close();live.peers.delete(id); }
function newPeer(id) {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
  const peer = { pc, candidates: [], offering: false, sentTracks: false, created: Date.now() };
  live.peers.set(id, peer);
  const broadcast = live.id;
  pc.onicecandidate = e => { if (e.candidate && live.id === broadcast && liveActive()) liveSignal(id, { kind: 'candidate', candidate: e.candidate.toJSON() }).catch(() => {}); };
  pc.ontrack = e => { if (live.id !== broadcast) return;if(e.streams[0])live.remote=e.streams[0];else{live.remote??=new MediaStream();if(!live.remote.getTracks().some(t=>t.id===e.track.id))live.remote.addTrack(e.track);}mountLive(); };
  pc.onconnectionstatechange = () => { if (live.id === broadcast) mountLive(); };
  return peer;
}
async function offerViewer(id, restart = false) {
  if (!media.stream || !isCreator() || !liveActive()) return;
  let peer = live.peers.get(id);
  if (peer && !restart) return;
  if (peer) dropPeer(id);
  peer = newPeer(id);peer.offering = true;
  // Negotiate empty senders before going live. Private preview tracks are never
  // attached until the creator explicitly presses Go live.
  peer.video = peer.pc.addTransceiver('video', { direction: 'sendonly',streams:[media.stream] }).sender;
  peer.audio = peer.pc.addTransceiver('audio', { direction: 'sendonly',streams:[media.stream] }).sender;
  try {
    await peer.pc.setLocalDescription(await peer.pc.createOffer());
    await liveSignal(id, { kind: 'description', description: { type: peer.pc.localDescription.type, sdp: peer.pc.localDescription.sdp } });
    if (state.phase === 'record' && state.liveMode) await attachTracks(peer);
  } catch (e) { live.error = e.message;mountLive(); } finally { peer.offering = false; }
}
async function attachTracks(peer) {
  if (!media.stream || peer.sentTracks) return;
  if(peer.attaching)return peer.attaching;
  const video=media.stream.getVideoTracks()[0],audio=media.stream.getAudioTracks()[0];
  if(!audio||audio.readyState!=='live'){live.error='No active microphone track. Reconnect camera & microphone.';return;}
  peer.attaching=Promise.all([peer.video.replaceTrack(video),peer.audio.replaceTrack(audio)]).then(()=>{peer.sentTracks=true;}).catch(e=>{live.error='Could not send microphone/audio. Reconnect your camera and microphone.';throw e;}).finally(()=>{peer.attaching=null;});
  return peer.attaching;
}
async function receiveSignal(message) {
  if (!liveActive() || message.liveId !== state.liveId) return;
  const id = message.from, payload = message.payload;
  if (payload.kind === 'ready') { if (isCreator() && media.stream) await offerViewer(id, true);return; }
  let peer = live.peers.get(id);
  if (payload.kind === 'description' && payload.description.type === 'offer') {
    if (isCreator()) return;
    const waiting = peer?.candidates || [];if (peer) dropPeer(id);peer = newPeer(id);peer.candidates = waiting;
    await peer.pc.setRemoteDescription(payload.description);
    for (const c of peer.candidates.splice(0)) await peer.pc.addIceCandidate(c);
    await peer.pc.setLocalDescription(await peer.pc.createAnswer());
    await liveSignal(id, { kind: 'description', description: { type: peer.pc.localDescription.type, sdp: peer.pc.localDescription.sdp } });
  } else if (payload.kind === 'description' && peer) {
    await peer.pc.setRemoteDescription(payload.description);
    for (const c of peer.candidates.splice(0)) await peer.pc.addIceCandidate(c);
  } else if (payload.kind === 'candidate') {
    if (!peer) peer = newPeer(id);
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(payload.candidate);else peer.candidates.push(payload.candidate);
  }
  mountLive();
}
accept = function(data) {
  liveBaseAccept(data);
  for (const msg of data.signals || []) live.queue = live.queue.then(() => receiveSignal(msg)).catch(e => { live.error = 'Live connection interrupted. Try reconnecting.';mountLive(); });
};
render = function() { liveBaseRender();mountLive(); };
function mountLive() {
  if(state?.promptsRemaining===0&&['pass','draw','board'].includes(state.phase)&&state.host===state.you&&!document.getElementById('end-used-session')){const b=document.createElement('button');b.id='end-used-session';b.className='btn ghost';b.dataset.live='endSession';b.textContent='All prompts used · End session';app.append(b);}
  const active = liveActive();
  if (!active) {
    if (live.id) { closeLive();live.id = '';if (state?.liveMode) releaseCamera(); }
    document.body.classList.toggle('watch-mode', !!(state?.phase === 'verdict' && state.clip));return;
  }
  if (live.id !== state.liveId) { closeLive();live.id = state.liveId; }
  const creator = isCreator(), broadcasting = state.phase === 'record' && state.liveMode;
  const panel = document.getElementById('media-panel'); if (!panel) return;
  document.body.classList.toggle('watch-mode', broadcasting || state.phase === 'verdict');
  if (state.phase === 'draw' && creator) {
    const button = panel.querySelector('[data-media=recordVideo]');if (button) {button.dataset.live = 'start';button.textContent = '● Go live to the room';}
    const description = panel.querySelector('.record-studio .lede');if (description) description.textContent = media.stream ? 'Your preview is private. Go live when ready; everyone watches together.' : 'Enable your camera and microphone, then go live. Everyone watches as you perform.';
    const uploadLabel = panel.querySelector('.upload-label');if (uploadLabel) uploadLabel.hidden = true;
    const redraw=app.querySelector('[data-action=redraw]');if(redraw)redraw.disabled=state.promptsRemaining===0;
    let status = document.getElementById('live-ready');if (!status) {status = document.createElement('p');status.id = 'live-ready';status.className = 'status';panel.querySelector('.record-studio').append(status);}
    const connected = [...live.peers.values()].filter(p => p.pc.connectionState === 'connected').length;
    status.textContent = media.stream ? `Live connections ready: ${connected}/${state.players.length - 1}. Camera and mic stay private until Go live.` : 'Live mode · No upload or replay wait';
    if (media.stream) for (const p of state.players) if (p.id !== state.you && p.online) offerViewer(p.id).catch(() => {});
  }
  if (broadcasting) {
    panel.classList.add('watch-layout');
    const avatarFinder = app.querySelector('.viewfinder');if (avatarFinder) avatarFinder.hidden = true;
    const oldStop = app.querySelector('[data-action=stop]');if (oldStop) oldStop.hidden = true;
    const hint = [...app.querySelectorAll('p')].find(p => /Listen to the apology|creator is recording a private take/.test(p.textContent));if (hint) hint.hidden = true;
    let stage = document.getElementById('live-stage');
    if (!stage) {stage = document.createElement('section');stage.id = 'live-stage';stage.className = 'record-studio';stage.innerHTML = `<div class="studio-label"><span class="rec-dot">● LIVE</span><span id="live-timer"></span></div><div id="live-video-slot" class="camera-stage"></div><p class="status" id="live-status"></p><div class="prompt-overlay">${esc(state.card[0])}<small>Twist: ${esc(state.twist)}</small></div>${creator ? '<button class="btn" data-live="stop">End live apology & vote</button>' : '<button class="btn ghost" data-live="sound">Enable live sound</button><button class="chip" data-live="reconnect">Reconnect video</button>'}<p class="error" id="live-error"></p>`;panel.prepend(stage);}
    const slot = document.getElementById('live-video-slot');
    if (creator && media.stream) {
      if (!live.selfVideo) {live.selfVideo = document.createElement('video');live.selfVideo.muted = true;live.selfVideo.autoplay = true;live.selfVideo.playsInline = true;live.selfVideo.srcObject = media.stream;live.selfVideo.className = 'camera-preview';live.selfVideo.setAttribute('aria-label','Your live camera');}
      if (live.selfVideo.parentElement !== slot) slot.append(live.selfVideo);
      live.selfVideo.play().catch(()=>{});
      for (const peer of live.peers.values()) if (peer.video) attachTracks(peer).catch(()=>{});
      for (const p of state.players) if(p.id!==state.you&&p.online)offerViewer(p.id).catch(()=>{});
    } else if (!creator && live.remote) {
      if (!live.video) {live.video = document.createElement('video');live.video.autoplay = true;live.video.muted = true;live.video.playsInline = true;live.video.setAttribute('aria-label','Live apology stream');}
      if (live.video.srcObject !== live.remote) live.video.srcObject = live.remote;
      if (live.video.parentElement !== slot) slot.append(live.video);
      live.video.muted=true;live.video.play().catch(()=>{});routeLiveAudio();
    }
    const connected = [...live.peers.values()].filter(p => p.pc.connectionState === 'connected').length;
    const soundOn=live.soundWanted&&live.audioContext?.state==='running';
    const mic=creator?media.stream?.getAudioTracks()[0]:live.remote?.getAudioTracks()[0];
    document.getElementById('live-status').textContent = creator ? `Broadcasting to ${connected}/${state.players.length - 1} viewers. ${mic?.enabled&&mic.readyState==='live'?'Microphone connected.':'Microphone missing or muted.'} Not recorded.` : connected && live.remote ? (soundOn?(mic?'Live now · Speaker audio enabled.':'Sound enabled · Waiting for microphone audio…'):'Tap Enable live sound to hear the apology.') : (soundOn?'Sound enabled · Connecting to the creator…':'Connecting to the creator… Enable live sound now to listen when it arrives.');
    const soundButton=stage.querySelector('[data-live=sound]');if(soundButton)soundButton.textContent=soundOn?'Mute live sound':'Enable live sound';
    let meter=document.getElementById('live-audio-meter');if(!meter&&!creator){meter=document.createElement('p');meter.id='live-audio-meter';meter.className='status';meter.setAttribute('role','status');stage.querySelector('#live-status').after(meter);}
    if(meter){meter.dataset.bytes=String(live.audioBytes);meter.dataset.energy=String(live.audioEnergy);meter.dataset.level=String(live.audioLevel);meter.textContent=!soundOn?'Sound is off.':!mic?'No microphone track received yet.':live.audioLevel>.001?'Receiving microphone sound ▂▄▆█':live.audioBytes>0?'Microphone audio connected · Currently quiet.':'Waiting for microphone audio packets…';}
    const activityText=panel.querySelector('.audience-play .lede');if(activityText)activityText.textContent='Doodle while you watch the live apology. Your drawing stays on your screen.';
    document.getElementById('live-error').textContent = live.error || ([...live.peers.values()].some(p=>p.pc.connectionState==='failed'||(p.pc.connectionState!=='connected'&&Date.now()-p.created>12000)) ? 'This network is having trouble connecting directly. Try Reconnect video or another network. Some networks require a relay service.' : '');
    if(creator&&!media.stream&&!stage.querySelector('[data-live=restore]')){const restore=document.createElement('button');restore.className='btn ghost';restore.dataset.live='restore';restore.textContent='Reconnect camera & microphone';stage.append(restore);}
    if (!creator && !live.peers.size && Date.now() - live.readyAt > 5000) {live.readyAt = Date.now();liveSignal(state.players[state.turn].id,{kind:'ready'}).catch(()=>{});}
  }
}
// Window capture runs before the recording handler on the app, making live
// broadcast the default while retaining the existing recorded fallback code.
window.addEventListener('click', async e => {
  const b = e.target.closest('[data-live]');if (!b) return;
  e.preventDefault();e.stopImmediatePropagation();
  if (busy || live.starting) return;
  const command = b.dataset.live;
  if (command === 'sound') {try{if(live.soundWanted&&live.audioContext?.state==='running'){live.soundWanted=false;disconnectAudio();}else await enableLiveSound();live.error='';}catch{live.error='Your browser blocked audio. Tap Enable live sound again.';}mountLive();return;}
  if (command === 'reconnect') {for(const id of live.peers.keys())dropPeer(id);live.remote=null;live.video?.remove();live.video=null;live.error='';live.readyAt=Date.now();await liveSignal(state.players[state.turn].id,{kind:'ready'}).catch(()=>{});mountLive();return;}
  busy=true;live.starting=true;
  try {
    if (command === 'start') {if (!media.stream) await enableCamera();if(media.stream)accept(await mediaAction('record',{live:true}));}
    if(command==='restore'){media.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:360}},audio:true});media.turn=mediaTurn();for(const id of live.peers.keys())dropPeer(id);live.selfVideo=null;b.remove();}
    if (command === 'stop') {accept(await mediaAction('stop'));releaseCamera();}
    if(command==='endSession')accept(await mediaAction('endSession'));
  } catch(e) {media.error=e.message;render();}finally{busy=false;live.starting=false;mountLive();}
}, true);
window.addEventListener('pagehide',closeLive);
setInterval(async()=>{
 if(live.audioAnalyser){const samples=new Float32Array(live.audioAnalyser.fftSize);live.audioAnalyser.getFloatTimeDomainData(samples);live.audioLevel=Math.sqrt(samples.reduce((s,n)=>s+n*n,0)/samples.length);}
 if(!isCreator()&&state?.liveMode&&state.phase==='record')for(const {pc}of live.peers.values()){try{const stats=await pc.getStats();stats.forEach(s=>{if(s.type==='inbound-rtp'&&s.kind==='audio'){live.audioBytes=s.bytesReceived||0;live.audioEnergy=s.totalAudioEnergy||0;}});}catch{}}
},500);
setInterval(()=>{if(state?.liveMode&&state.phase==='record'){const t=document.getElementById('live-timer');if(t)t.textContent=Math.max(0,Math.ceil((state.deadline-Date.now())/1000))+'s';}mountLive();},1000);
mountLive();
