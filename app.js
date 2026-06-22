/* Audio Visualizer — reacts to an uploaded track or the microphone using the
   Web Audio API's AnalyserNode. Three canvas modes: spectrum bars, a radial
   burst, and a glowing waveform. Fully client-side. */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audio = document.getElementById("audio");

const THEMES = [
  { hue: 274, spread: 124 },   // sunset: violet → pink → amber
  { hue: 320, spread: 86 },    // pink → coral
  { hue: 28,  spread: 64 },    // amber → gold
  { hue: 250, spread: 96 },    // violet → magenta
];
const BG = "#190b24";          // deep plum
let theme = 0;
let mode = 0;
let livelyActive = false;   // true once Lively Wallpaper starts feeding audio
let sensitivity = 1;

let audioCtx = null, analyser = null, freq = null, wave = null;
let srcNode = null, activeSrc = null, micStream = null;
let mediaConnected = false;   // MediaElementSource can be created only once
let playing = false, hasAudio = false;

/* ---------- canvas sizing ---------- */
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

/* ---------- audio graph ---------- */
function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.74;
    freq = new Uint8Array(analyser.frequencyBinCount);
    wave = new Uint8Array(analyser.fftSize);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function connect(node, hear) {
  if (activeSrc) { try { activeSrc.disconnect(); } catch (e) {} }
  analyser.disconnect();
  node.connect(analyser);
  if (hear) analyser.connect(audioCtx.destination);
  activeSrc = node;
}

function loadFile(file) {
  ensureCtx();
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  audio.src = URL.createObjectURL(file);
  if (!mediaConnected) { srcNode = audioCtx.createMediaElementSource(audio); mediaConnected = true; }
  connect(srcNode, true);
  audio.play();
  hasAudio = true; playing = true;
  document.getElementById("playBtn").disabled = false;
  setPlayIcon(true);
  dismissHint();
  showTrack(file.name.replace(/\.[^.]+$/, ""), "");   // show file name as title
}

let trackTimer = null;
function showTrack(title, artist) {
  const el = document.getElementById("now");
  if (!title) { el.classList.remove("show"); return; }
  el.innerHTML = `<div class="np-title">${title}</div>` + (artist ? `<div class="np-artist">${artist}</div>` : "");
  el.classList.add("show");
  clearTimeout(trackTimer);
  trackTimer = setTimeout(() => el.classList.remove("show"), 5000);   // fade after 5s
}

async function useMic() {
  ensureCtx();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) { return; }
  audio.pause();
  const node = audioCtx.createMediaStreamSource(micStream);
  connect(node, false);     // don't pipe mic to speakers (feedback)
  hasAudio = true; playing = true;
  document.getElementById("playBtn").disabled = true;
  dismissHint();
}

function togglePlay() {
  if (!hasAudio || micStream) return;
  if (audio.paused) { ensureCtx(); audio.play(); playing = true; setPlayIcon(true); }
  else { audio.pause(); playing = false; setPlayIcon(false); }
}

function setPlayIcon(isPlaying) {
  document.getElementById("playIcon").innerHTML =
    isPlaying ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>' : '<path d="M7 5l12 7-12 7z"/>';
}

function dismissHint() { document.getElementById("hint").classList.add("gone"); }

/* ---------- data (real or idle) ---------- */
function readData() {
  const t = performance.now() / 1000;
  if (livelyActive) return;   // Lively feeds freq[] via livelyAudioListener
  if (analyser && playing && !audio.paused || (analyser && micStream)) {
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(wave);
    const gain = 1.55 * sensitivity;   // music rarely fills the range — boost it
    for (let i = 0; i < freq.length; i++) freq[i] = Math.min(255, freq[i] * gain);
    return;
  }
  // idle: gentle synthetic motion so the canvas is never dead
  const n = freq ? freq.length : 1024;
  if (!freq) { freq = new Uint8Array(n); wave = new Uint8Array(2048); }
  for (let i = 0; i < freq.length; i++) {
    const f = i / freq.length;
    freq[i] = Math.max(0, (Math.sin(t * 1.4 + f * 9) * 0.5 + 0.5) * (1 - f) * 150 * (0.5 + 0.5 * Math.sin(t * 0.6)));
  }
  for (let i = 0; i < wave.length; i++) {
    wave[i] = 128 + Math.sin(t * 2 + i / wave.length * 12) * 36 * Math.sin(t * 0.5);
  }
}

function avg(arr, a, b) { let s = 0; for (let i = a; i < b; i++) s += arr[i]; return s / (b - a); }

/* ---------- background ---------- */
function background(vol) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.6, 0, W / 2, H * 0.6, Math.max(W, H) * 0.75);
  const { hue, spread } = THEMES[theme];
  g.addColorStop(0, `hsla(${hue + spread * 0.4},85%,58%,${0.06 + vol * 0.26})`);
  g.addColorStop(1, "rgba(25,11,36,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/* ---------- modes ---------- */

// 0 — Aurora: smooth mirrored frequency ribbon flowing across the screen
function drawAurora() {
  const { hue, spread } = THEMES[theme];
  const cy = H / 2;
  const pts = 80;
  const usable = Math.floor(freq.length * 0.62);
  const ys = [];
  for (let i = 0; i <= pts; i++) {
    const t = i / pts;
    const fi = Math.floor((t < 0.5 ? t * 2 : (1 - t) * 2) * usable);
    ys.push(Math.pow(freq[fi] / 255, 1.3));
  }
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, `hsl(${hue},90%,62%)`);
  grad.addColorStop(0.5, `hsl(${hue + spread * 0.5},92%,64%)`);
  grad.addColorStop(1, `hsl(${hue + spread},92%,62%)`);
  ctx.shadowBlur = 34; ctx.shadowColor = `hsl(${hue + spread * 0.5},90%,60%)`;
  for (const dir of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(0, cy);
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * W;
      ctx.lineTo(x, cy - dir * ys[i] * H * 0.42);
    }
    ctx.lineTo(W, cy);
    ctx.closePath();
    ctx.globalAlpha = dir === 1 ? 0.9 : 0.4;
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// 1 — Orb: a glowing blob whose edge is shaped by the spectrum and pulses on the bass
function drawOrb() {
  const { hue, spread } = THEMES[theme];
  const cx = W / 2, cy = H / 2;
  const base = Math.min(W, H) * 0.17;
  const bass = avg(freq, 0, 26) / 255;
  const pts = 140, usable = Math.floor(freq.length * 0.5);
  const rot = performance.now() / 6000;

  // outer halo
  const halo = ctx.createRadialGradient(cx, cy, base * 0.5, cx, cy, base * 3.2);
  halo.addColorStop(0, `hsla(${hue + spread * 0.4},90%,60%,${0.16 + bass * 0.25})`);
  halo.addColorStop(1, "rgba(25,11,36,0)");
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);

  ctx.beginPath();
  for (let i = 0; i <= pts; i++) {
    const t = i / pts;
    const fi = Math.floor((t < 0.5 ? t * 2 : (1 - t) * 2) * usable);
    const v = Math.pow(freq[fi] / 255, 1.25);
    const r = base * (1 + bass * 0.35) + v * base * 1.15;
    const a = t * Math.PI * 2 + rot;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx, cy, base * 0.3, cx, cy, base * 2.2);
  g.addColorStop(0, `hsla(${hue},92%,66%,0.9)`);
  g.addColorStop(1, `hsla(${hue + spread},90%,58%,0.35)`);
  ctx.fillStyle = g;
  ctx.shadowBlur = 40; ctx.shadowColor = `hsl(${hue + spread * 0.4},90%,60%)`;
  ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = `hsl(${hue + spread * 0.6},95%,72%)`;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// 2 — Particles: a drifting field that brightens with volume and bursts on the beat
let particles = null, prevBass = 0;
function drawParticles(vol) {
  const { hue, spread } = THEMES[theme];
  const cx = W / 2, cy = H / 2;
  if (!particles || particles.length === 0) {
    particles = Array.from({ length: 130 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      s: 1 + Math.random() * 2.4, h: Math.random(),
    }));
  }
  const bass = avg(freq, 0, 26) / 255;
  const beat = bass > 0.55 && bass - prevBass > 0.06;
  prevBass = bass;

  for (const p of particles) {
    if (beat) {
      const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
      p.vx += (dx / d) * 2.2; p.vy += (dy / d) * 2.2;
    }
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.94; p.vy *= 0.94;
    if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
    if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    const size = p.s * (0.7 + vol * 3.2);
    const c = `hsl(${hue + p.h * spread}, 92%, ${60 + vol * 18}%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.globalAlpha = 0.35 + vol * 0.6;
    ctx.shadowBlur = 14; ctx.shadowColor = c;
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

function roundRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- loop ---------- */
function frame() {
  readData();
  const vol = freq ? avg(freq, 0, freq.length) / 255 : 0;
  background(vol);
  if (mode === 0) drawAurora();
  else if (mode === 1) drawOrb();
  else drawParticles(vol);
  requestAnimationFrame(frame);
}
frame();

/* ---------- controls ---------- */
document.getElementById("loadBtn").addEventListener("click", () => document.getElementById("file").click());
document.getElementById("file").addEventListener("change", e => { if (e.target.files[0]) loadFile(e.target.files[0]); });
document.getElementById("playBtn").addEventListener("click", togglePlay);
document.getElementById("micBtn").addEventListener("click", useMic);
document.getElementById("themeBtn").addEventListener("click", () => { theme = (theme + 1) % THEMES.length; });
audio.addEventListener("ended", () => { playing = false; setPlayIcon(false); });

function setMode(i) {
  mode = i;
  document.querySelectorAll(".mode").forEach(x => x.classList.toggle("active", +x.dataset.mode === i));
}
document.querySelectorAll(".mode").forEach(b => b.addEventListener("click", () => setMode(+b.dataset.mode)));

/* ---------- Lively Wallpaper integration ----------
   Lively streams the system's audio and lets the user tweak settings from its
   Customise panel (see LivelyProperties.json). When that happens we hide the
   on-screen controls so the desktop stays clean. */
function hideControlsForWallpaper() {
  document.getElementById("bar").style.display = "none";
  document.getElementById("hint").classList.add("gone");
}

// Lively calls this every frame with 128 audio samples (low → high freq)
window.livelyAudioListener = function (arr) {
  if (!arr || !arr.length) return;
  if (!freq) { freq = new Uint8Array(1024); wave = new Uint8Array(2048); }
  if (!livelyActive) { livelyActive = true; hideControlsForWallpaper(); }
  // normalise to the frame's peak (like rocksdanister's sample) so it fills the
  // full range whatever scale Lively uses; floor avoids blow-up on silence
  let max = 1;
  for (let i = 0; i < arr.length; i++) if (arr[i] > max) max = arr[i];
  for (let i = 0; i < freq.length; i++) {
    const v = arr[Math.floor((i / freq.length) * arr.length)] || 0;
    freq[i] = Math.max(0, Math.min(255, (v / max) * 255 * sensitivity));
  }
};

// Lively sends the currently playing media (title, artist) — show it in the centre
window.livelyCurrentTrack = function (data) {
  try {
    if (!data) { showTrack(""); return; }
    const d = typeof data === "string" ? JSON.parse(data) : data;
    const title = d.Title || d.title || "";
    const artist = d.Artist || d.artist || "";
    if (title) { showTrack(title, artist); clearTimeout(trackTimer); document.getElementById("now").classList.add("show"); }
    else showTrack("");
  } catch (e) {}
};

// Lively calls this when a property changes in its Customise panel
window.livelyPropertyListener = function (name, val) {
  if (name === "mode") setMode(+val);
  else if (name === "theme") theme = +val % THEMES.length;
  else if (name === "sensitivity") sensitivity = +val;
  else if (name === "showControls") {
    document.getElementById("bar").style.display = val ? "" : "none";
  }
};
