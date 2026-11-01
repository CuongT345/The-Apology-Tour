// Camera studio, room-only playback, simulated chat, and audience activities.
const baseRender = render;
const media = { stream: null, recorder: null, chunks: [], blob: null, url: '', localVideo: null, preview: null, turn: '', error: '', uploading: false, roomVideo: null, roomUrl: '', roomId: '', fetching: '', fetchError: '', canvas: null, canvasTurn: '', started: 0 };
const mediaTurn = () => state ? `${state.code}:${state.round}:${state.turn}` : '';
const mediaAction = (action, data = {}) => api('action', { ...session, action, ...data });
const mediaHeaders = () => ({ Authorization: 'Bearer ' + session.token, 'X-Room': session.code });
const mediaButton = (text, action, disabled = false, extra = '') => `<button class="btn ${extra}" data-media="${action}" ${disabled ? 'disabled' : ''}>${text}</button>`;
const icons = { heart: '❤️', laugh: '😂', popcorn: '🍿', fire: '🔥' };
const chatLines = [
  ['popcorn_bot', 'Chat, grab your popcorn 🍿'], ['notes_app', 'The Notes app has entered the chat.'],
  ['hoodie_watch', 'Is the accountability hoodie on?'], ['mom_bot', 'Call me after this.'],
  ['growth_era', 'Character development loading…'], ['receipts_bot', 'We are respectfully taking notes.'],
  ['sad_piano', 'Imagine a very emotional piano right now.'], ['plot_twist', 'Waiting for the redemption arc.'],
  ['chat_mod', 'Reminder: commit to the bit.'], ['sponsor_bot', 'This apology is sponsored by consequences.'],
  ['popcorn_bot', 'The suspense is personally affecting me.'], ['notes_app', 'No pressure, just the whole internet.']
];
function releaseCamera() {
  media.stream?.getTracks().forEach(t => t.stop()); media.stream = null;
  if (media.preview) { media.preview.srcObject = null; media.preview.remove(); media.preview = null; }
}
function clearLocalClip() {
  media.turn = '';
  if (media.recorder?.state === 'recording') media.recorder.stop();
  media.recorder = null; releaseCamera(); media.blob = null; media.chunks = [];
  media.localVideo?.pause(); media.localVideo?.remove(); media.localVideo = null;
  if (media.url) URL.revokeObjectURL(media.url); media.url = '';
}
function clearRoomClip() {
  media.roomVideo?.pause(); media.roomVideo?.remove(); media.roomVideo = null;
  if (media.roomUrl) URL.revokeObjectURL(media.roomUrl);
  media.roomUrl = ''; media.roomId = ''; media.fetching = ''; media.fetchError = '';
}
function setClip(blob) {
  media.localVideo?.remove(); media.localVideo = null;
  if (media.url) URL.revokeObjectURL(media.url);
  media.blob = blob; media.url = URL.createObjectURL(blob); media.turn = mediaTurn();
  render();
}
async function enableCamera() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('This browser cannot record video. Choose a recorded WebM/MP4 or perform without camera.');
  const key = mediaTurn();
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } }, audio: { echoCancellation: true, noiseSuppression: true } });
  if (mediaTurn() !== key || state.phase !== 'draw') { stream.getTracks().forEach(t => t.stop()); return; }
  releaseCamera(); media.stream = stream; media.turn = key; render();
}
async function recordVideo() {
  if (!media.stream) await enableCamera();
  if (!media.stream) return;
  const key = mediaTurn(); media.chunks = []; media.blob = null;
  const mimeType = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
  const rec = new MediaRecorder(media.stream, { videoBitsPerSecond: 700000, audioBitsPerSecond: 64000, ...(mimeType ? { mimeType } : {}) });
  let size = 0;
  rec.ondataavailable = e => {
    if (key !== media.turn || !e.data.size) return;
    media.chunks.push(e.data); size += e.data.size;
    if (size > 15 * 1024 * 1024 && rec.state === 'recording') rec.stop();
  };
  rec.onerror = () => { media.error = 'Recording was interrupted. Please retake your apology.'; if (rec.state === 'recording') rec.stop(); };
  rec.onstop = async () => {
    releaseCamera(); if (key !== media.turn) return;
    const blob = new Blob(media.chunks, { type: rec.mimeType || 'video/webm' });
    media.chunks = []; media.recorder = null;
    if (blob.size > 0 && blob.size <= 16 * 1024 * 1024) setClip(blob);
    else media.error = 'The recording was empty or too large. Please retake it.';
    try { if (state?.phase === 'record' && mediaTurn() === key) accept(await mediaAction('stop')); }
    catch (e) { media.error = e.message; }
    render();
  };
  media.recorder = rec; media.turn = key;
  try { accept(await mediaAction('record', { video: true })); rec.start(1000); }
  catch (e) { media.recorder = null; releaseCamera(); throw e; }
}
async function shareVideo() {
  media.uploading = true; render();
  try {
    if (media.blob) {
      const response = await fetch('/api/clip', { method: 'POST', headers: { ...mediaHeaders(), 'Content-Type': media.blob.type.startsWith('video/mp4') ? 'video/mp4' : 'video/webm' }, body: media.blob });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); accept(data);
    }
    accept(await mediaAction('publish')); clearLocalClip();
  } finally { media.uploading = false; render(); }
}
function attachVideos() {
  const previewSlot = document.getElementById('camera-slot');
  if (previewSlot && media.stream) {
    if (!media.preview) { const v = document.createElement('video'); v.autoplay = true; v.muted = true; v.playsInline = true; v.srcObject = media.stream; v.className = 'camera-preview'; v.setAttribute('aria-label', 'Private camera preview'); media.preview = v; }
    if (media.preview.parentElement !== previewSlot) previewSlot.append(media.preview);
    media.preview.play().catch(() => {});
  }
  const localSlot = document.getElementById('clip-preview-slot');
  if (localSlot && media.url) {
    if (!media.localVideo) { const v = document.createElement('video'); v.src = media.url; v.controls = true; v.playsInline = true; v.setAttribute('aria-label', 'Preview your recorded apology'); media.localVideo = v; }
    if (media.localVideo.parentElement !== localSlot) localSlot.append(media.localVideo);
    if (!localSlot.querySelector('a')) { const a = document.createElement('a'); a.href = media.url; a.download = 'my-apology.' + (media.blob.type.startsWith('video/mp4') ? 'mp4' : 'webm'); a.textContent = 'Download my take'; a.className = 'linkbtn'; localSlot.append(a); }
  }
  if (!state?.clip || !['review', 'verdict'].includes(state.phase)) { if (media.roomId) clearRoomClip(); return; }
  const slot = document.getElementById('shared-video-slot'); if (!slot) return;
  if (media.roomId && media.roomId !== state.clip.id) clearRoomClip();
  if (media.roomVideo) { if (media.roomVideo.parentElement !== slot) slot.append(media.roomVideo); return; }
  if (media.fetching || media.fetchError) return;
  const id = state.clip.id; media.fetching = id;
  fetch('/api/clip', { headers: mediaHeaders() }).then(async r => {
    if (!r.ok) throw new Error('Video did not load. Try again.');
    const blob = await r.blob();
    if (state?.clip?.id !== id || !['review', 'verdict'].includes(state.phase)) return;
    media.roomUrl = URL.createObjectURL(blob); media.roomId = id;
    const v = document.createElement('video'); v.src = media.roomUrl; v.controls = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('aria-label', 'Shared apology video'); media.roomVideo = v;
    v.onended = async () => { if (state?.phase !== 'verdict' || state.watched.includes(state.you)) return; try { accept(await mediaAction('watched', { clipId: id })); } catch (e) { media.error = e.message; render(); } };
    v.onerror = () => { media.fetchError = 'Your browser could not play this video. Try a browser that supports this WebM/MP4 file.'; render(); };
  }).catch(e => { media.fetchError = e.message; }).finally(() => { media.fetching = ''; render(); });
}
function drawingBoard() {
  const slot = document.getElementById('drawing-slot'); if (!slot) return;
  if (media.canvasTurn !== mediaTurn()) { media.canvas = null; media.canvasTurn = mediaTurn(); }
  if (!media.canvas) {
    const c = document.createElement('canvas'); c.width = 900; c.height = 500; c.setAttribute('aria-label', 'Draw fan art here'); media.canvas = c;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff5bd'; ctx.fillRect(0, 0, c.width, c.height);
    let drawing = false, point;
    const pos = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
    c.onpointerdown = e => { drawing = true; point = pos(e); c.setPointerCapture(e.pointerId); };
    c.onpointermove = e => { if (!drawing) return; const p = pos(e); ctx.strokeStyle = document.getElementById('ink-color')?.value || '#2a2410'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...point); ctx.lineTo(...p); ctx.stroke(); point = p; };
    c.onpointerup = c.onpointercancel = () => { drawing = false; };
  }
  if (media.canvas.parentElement !== slot) slot.append(media.canvas);
}
function chatHTML() {
  return `<section class="chat-panel"><div class="chat-heading"><b>Live chat</b><small>SIMULATED BOTS</small></div><div id="bot-comments"></div><div id="reaction-counts" class="reaction-totals"></div></section>`;
}
function activitiesHTML() {
  return `<section class="audience-play"><div class="eyebrow">Backstage pass</div><h2>Make some fan art.</h2><p class="lede">Doodle while the creator records. Your drawing stays on your screen.</p><div id="drawing-slot"></div><div class="row"><button class="chip" data-media="clearDrawing">Clear drawing</button><button class="chip" data-media="saveDrawing">Save drawing</button><label class="pen-color">Ink <input id="ink-color" type="color" value="#2a2410" aria-label="Drawing ink color"></label></div>${state.phase === 'record' ? `<p>Send a reaction to the creator</p><div class="row">${Object.entries(icons).map(([k, icon]) => `<button class="reaction-btn" data-media="react" data-reaction="${k}" aria-label="Send ${k} reaction">${icon}</button>`).join('')}</div>` : ''}</section>`;
}
function sharedHTML() {
  return `<section class="video-post"><h2>My apology.</h2><div id="shared-video-slot"></div><p class="status" id="playback-status">Press play to watch with sound.</p></section>`;
}
function mountExtras() {
  if (!state) return;
  if (media.turn && media.turn !== mediaTurn()) clearLocalClip();
  if (state.phase === 'review' && media.recorder?.state === 'recording') media.recorder.stop();
  const mine = state.players[state.turn]?.id === state.you;
  const layout = `${mediaTurn()}:${state.phase}:${mine}:${!!media.stream}:${!!media.blob}:${!!state.clip}`;
  let panel = document.getElementById('media-panel');
  if (!panel || panel.dataset.layout !== layout) {
    // Preserve actual video and canvas elements across updates to shared state.
    media.preview?.remove(); media.localVideo?.remove(); media.roomVideo?.remove(); media.canvas?.remove(); panel?.remove();
    panel = document.createElement('div'); panel.id = 'media-panel'; panel.className = 'stack'; panel.dataset.layout = layout;
    let html = '';
    if (state.phase === 'draw' && mine) html = `<section class="record-studio"><div class="studio-label">APOLOGY STUDIO</div><div id="camera-slot" class="camera-stage">${media.stream ? '' : '<span>YOUR COMEBACK STARTS HERE</span>'}</div><p class="lede">${media.stream ? 'Frame your shot. This preview is private.' : 'Record your actual apology with camera and microphone. Preview it before sharing.'}</p>${mediaButton(media.stream ? '● Record my apology' : 'Enable camera & microphone', media.stream ? 'recordVideo' : 'enableCamera')}<p class="status">${state.seconds} seconds · Camera + microphone · Room-only playback</p></section><label class="upload-label">Or choose a recorded WebM/MP4 (up to 16 MB)<input id="video-file" type="file" accept="video/webm,video/mp4"></label>`;
    if (state.phase === 'record') {
      media.started = state.deadline - state.seconds * 1000;
      html = `${mine && state.videoMode ? '<section class="record-studio"><div class="studio-label"><span class="rec-dot">● REC</span><span id="camera-timer"></span></div><div id="camera-slot" class="camera-stage"></div><div class="prompt-overlay">' + esc(state.card[0]) + '<small>Twist: ' + esc(state.twist) + '</small></div>' + mediaButton('■ Stop & preview', 'stopCapture') + '</section>' : ''}${chatHTML()}${!mine ? activitiesHTML() : ''}`;
    }
    if (state.phase === 'review') html = mine ? `<div class="eyebrow">Your final cut</div><h1>Before you post.</h1><section class="video-post"><div id="clip-preview-slot"></div><p class="status">${media.blob ? 'Preview with sound. Your clip stays private until you share it.' : state.clip ? 'Your apology is uploaded and ready to share.' : 'No recording found. Retake your apology or choose a video.'}</p></section>${!media.blob && state.clip ? sharedHTML() : ''}${mediaButton('Share apology with room', 'publish', !media.blob && !state.clip)}${mediaButton('Retake apology', 'retake', false, 'ghost')}<label class="upload-label">Choose another video<input id="video-file" type="file" accept="video/webm,video/mp4"></label><button class="linkbtn" data-media="skipVideo">Continue without video</button><p class="status">Room-only playback. The clip is cleared when the tour advances.</p>` : `<h2>Editing the apology…</h2><p class="lede">The creator is reviewing their final take.</p>${chatHTML()}${activitiesHTML()}`;
    if (state.phase === 'verdict' && state.clip) html = sharedHTML() + '<p id="watch-before-vote" class="rules">Watch the apology to the end to unlock your private vote.</p>';
    panel.innerHTML = html + '<p class="error" id="media-error" role="alert"></p>';
    const foot = app.querySelector('.foot'); app.insertBefore(panel, foot || null);
  }
  if (state.phase === 'draw' && mine) { const button = app.querySelector('[data-action=record]'); if (button) { button.textContent = 'Perform without camera'; button.before(panel); } }
  if (state.phase === 'record' && mine && state.videoMode) {
    const oldFinder = app.querySelector('.viewfinder'); if (oldFinder) oldFinder.hidden = true;
    const oldButton = app.querySelector('[data-action=stop]'); if (oldButton) oldButton.hidden = true;
  }
  if (state.phase === 'record' && !mine && state.videoMode) {
    const hint = [...app.querySelectorAll('p')].find(p => p.textContent.includes('Listen to the apology.'));
    if (hint) hint.textContent = 'The creator is recording a private take. The finished clip will appear here.';
  }
  if (state.phase === 'verdict' && state.clip) {
    const unlocked = mine || state.watched.includes(state.you);
    const form = document.getElementById('vote'); if (form) form.hidden = !unlocked;
    const hint = document.getElementById('watch-before-vote'); if (hint) hint.hidden = unlocked;
    // Place the video above the verdict, so viewers see it before the vote controls.
    const firstHeading = app.querySelector('h2'); if (firstHeading && !panel.contains(firstHeading)) firstHeading.before(panel);
  }
  const message = document.getElementById('media-error'); if (message) message.textContent = media.error;
  panel.querySelectorAll('[data-media=publish]').forEach(b => { b.disabled = media.uploading || (!media.blob && !state.clip); b.textContent = media.uploading ? 'Uploading…' : 'Share apology with room'; });
  if (media.uploading) panel.querySelectorAll('button,input').forEach(b => b.disabled = true);
  const status = document.getElementById('playback-status'); if (status) status.textContent = media.fetchError || (media.fetching ? 'Loading apology video…' : 'Press play to watch with sound.');
  if (media.fetchError && !panel.querySelector('[data-media=retryVideo]')) { const b = document.createElement('button'); b.className = 'chip'; b.dataset.media = 'retryVideo'; b.textContent = 'Retry video'; status.after(b); }
  attachVideos(); drawingBoard(); mediaTick();
}
render = function () { baseRender(); mountExtras(); };
function mediaTick() {
  if (media.recorder?.state === 'recording' && state?.deadline && Date.now() >= state.deadline) media.recorder.stop();
  const timer = document.getElementById('camera-timer'); if (timer) timer.textContent = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) + 's';
  const box = document.getElementById('bot-comments');
  if (box) {
    const i = Math.floor(Math.max(0, Date.now() - media.started) / 3500), key = String(i);
    if (box.dataset.key !== key) { box.dataset.key = key; box.innerHTML = Array.from({ length: Math.min(4, i + 1) }, (_, n) => { const [name, text] = chatLines[(Math.max(0, i - 3) + n) % chatLines.length]; return `<div class="bot-comment"><b>${name}</b><small>BOT</small><span>${text}</span></div>`; }).join(''); }
  }
  const counts = document.getElementById('reaction-counts');
  if (counts) counts.innerHTML = Object.entries(icons).map(([k, icon]) => `<span>${icon} ${state.reactions?.[k] || 0}</span>`).join('');
}
app.addEventListener('click', async e => {
  const button = e.target.closest('[data-media]');
  if (!button) { const original = e.target.closest('[data-action]')?.dataset.action; if (original === 'leave') { clearLocalClip(); clearRoomClip(); } if (original === 'record') releaseCamera(); return; }
  e.preventDefault(); e.stopImmediatePropagation(); if (busy || button.disabled) return;
  const name = button.dataset.media;
  if (name === 'clearDrawing') { const c = media.canvas, ctx = c?.getContext('2d'); if (ctx) { ctx.fillStyle = '#fff5bd'; ctx.fillRect(0, 0, c.width, c.height); } return; }
  if (name === 'saveDrawing') { if (media.canvas) { const a = document.createElement('a'); a.href = media.canvas.toDataURL(); a.download = 'apology-tour-fan-art.png'; a.click(); } return; }
  if (name === 'retryVideo') { clearRoomClip(); render(); return; }
  busy = true; media.error = '';
  try {
    if (name === 'enableCamera') await enableCamera();
    else if (name === 'recordVideo') await recordVideo();
    else if (name === 'stopCapture') { if (media.recorder?.state === 'recording') media.recorder.stop(); else accept(await mediaAction('stop')); }
    else if (name === 'publish') await shareVideo();
    else if (name === 'react') accept(await mediaAction('react', { reaction: button.dataset.reaction }));
    else { clearLocalClip(); accept(await mediaAction(name)); }
  } catch (e) {
    media.error = e.name === 'NotAllowedError' ? 'Camera or microphone access was denied. Allow it in your browser, choose a recorded video, or perform without camera.' : e.name === 'NotFoundError' ? 'No camera or microphone was found. Choose a recorded video or perform without camera.' : e.message;
    render();
  } finally { busy = false; mountExtras(); }
}, true);
app.addEventListener('change', async e => {
  if (e.target.id !== 'video-file' || !e.target.files[0] || busy) return;
  const file = e.target.files[0];
  if (file.size > 16 * 1024 * 1024 || !/\.(webm|mp4)$/i.test(file.name)) { media.error = 'Choose a WebM or MP4 under 16 MB.'; mountExtras(); return; }
  busy = true; media.error = '';
  try {
    if (state.phase === 'draw') { accept(await mediaAction('record', { video: true })); accept(await mediaAction('stop')); }
    releaseCamera(); setClip(file);
  } catch (e) { media.error = e.message; mountExtras(); } finally { busy = false; }
});
window.addEventListener('pagehide', releaseCamera);
setInterval(mediaTick, 250); mountExtras();
