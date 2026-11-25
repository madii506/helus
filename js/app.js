// helus app: launch (draft + live card), replay, calculator, coins in orbit. Hash routes: #launch #replay #calc #orbit
import { $, $$, esc, toast, store } from './util.js';
import { mountReplay } from './replay.js?v=1';
import { feeAt, mult, SPLIT, PAYOUTS_PER_DAY, WALLET_CAP, fmtSol } from './model.js?v=1';

const VIEWS = ['launch', 'replay', 'calc', 'orbit'];
function show(v) {
  $$('.view').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  $$('.tabs a[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  document.title = `HELUS · ${{ launch: 'launch', replay: 'replay', calc: 'calculator', orbit: 'coins in orbit' }[v]}`;
  scrollTo({ top: 0 }); if (v === 'calc') drawCalc(); if (v === 'launch') sizeCard();
}
function route() { const [v, arg] = location.hash.slice(1).split('/'); const view = VIEWS.includes(v) ? v : 'launch'; show(view); if (view === 'replay' && arg) replay.run(decodeURIComponent(arg)); }
const q = new URLSearchParams(location.search).get('replay');
if (q) history.replaceState(null, '', `/app#replay/${encodeURIComponent(q)}`);

// ---------- the sky: drifting stars and slow orbits ----------
(() => {
  const cv = $('#sky'), c = cv.getContext('2d'); let w, h, stars = [];
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight; cv.width = w * d; cv.height = h * d; c.setTransform(d, 0, 0, d, 0, 0); stars = Array.from({ length: Math.round(w * h / 5200) }, () => ({ x: Math.random() * w, y: Math.random() * h, s: Math.random() < 0.1 ? 2 : 1, a: 0.2 + Math.random() * 0.6, p: Math.random() * 6 })); };
  size(); addEventListener('resize', size);
  let T = 0; const tick = () => { if (!document.hidden) { T += 0.016; c.clearRect(0, 0, w, h);
    for (const s of stars) { c.fillStyle = `rgba(188,216,255,${s.a * (0.65 + 0.35 * Math.sin(T * 1.3 + s.p))})`; c.fillRect(s.x, s.y, s.s, s.s); }
    const cx = w * 0.86, cy = h * 0.92; c.setLineDash([2, 8]); [260, 380, 520].forEach((r, i) => { c.strokeStyle = `rgba(156,208,255,${0.09 - i * 0.02})`; c.beginPath(); c.ellipse(cx, cy, r, r * 0.38, -0.25, 0, Math.PI * 2); c.stroke(); }); c.setLineDash([]);
    [260, 380, 520].forEach((r, i) => { for (let k = 0; k < 3; k++) { const a = T * (0.22 - i * 0.05) + k * 2.1 + i; const x = cx + Math.cos(a) * r * Math.cos(-0.25) - Math.sin(a) * r * 0.38 * Math.sin(-0.25), y = cy + Math.cos(a) * r * Math.sin(-0.25) + Math.sin(a) * r * 0.38 * Math.cos(-0.25); c.fillStyle = 'rgba(211,233,255,.5)'; c.fillRect(x - 2, y - 2, 4, 4); } });
  } requestAnimationFrame(tick); }; requestAnimationFrame(tick);
})();

// ---------- launch: draft, image, live card ----------
const draft = store.get('helus:draft', {});
const F = { name: $('#lName'), tick: $('#lTick'), desc: $('#lDesc'), x: $('#lX'), web: $('#lWeb'), buy: $('#lBuy') };
Object.entries(F).forEach(([k, el]) => { if (draft[k] != null) el.value = draft[k]; });
const imgCv = $('#lImg'), oImg = $('#oImg');
function drawImage(src) {
  const im = new Image(); im.onload = () => {
    for (const cv of [imgCv, oImg]) { const c = cv.getContext('2d'), s = Math.min(im.width, im.height); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingQuality = 'high'; c.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, cv.width, cv.height); }
    try { draft.img = imgCv.toDataURL('image/png'); store.set('helus:draft', draft); } catch { }
    $('#lDrop').classList.add('has');
  }; im.src = src;
}
function placeholder() {
  for (const cv of [imgCv, oImg]) { const c = cv.getContext('2d'), W = cv.width; c.fillStyle = '#0f1729'; c.fillRect(0, 0, W, W); c.fillStyle = 'rgba(156,208,255,.5)'; const u = W / 16; [[7, 4], [8, 4], [6, 5], [9, 5], [6, 6], [9, 6], [7, 7], [8, 7], [10, 3]].forEach(([x, y]) => c.fillRect(x * u, (y + 3) * u, u - 1, u - 1)); }
}
if (draft.img) drawImage(draft.img); else placeholder();
$('#lDrop').addEventListener('click', e => { if (e.target.tagName !== 'INPUT') $('#lFile').click(); });
$('#lFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = () => drawImage(r.result); r.readAsDataURL(f); } });
['dragover', 'dragenter'].forEach(t => $('#lDrop').addEventListener(t, e => { e.preventDefault(); $('#lDrop').classList.add('over'); }));
['dragleave', 'drop'].forEach(t => $('#lDrop').addEventListener(t, e => { e.preventDefault(); $('#lDrop').classList.remove('over'); }));
$('#lDrop').addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) { const r = new FileReader(); r.onload = () => drawImage(r.result); r.readAsDataURL(f); } });
F.tick.addEventListener('input', () => { const v = F.tick.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10); if (v !== F.tick.value) F.tick.value = v; });
function syncCard() {
  $('#pName').textContent = F.name.value.trim() || 'Your coin'; $('#pTick').textContent = `$${F.tick.value.trim() || 'TICKER'}`;
  $('#pDesc').textContent = F.desc.value.trim() || 'One line about your coin goes here.';
  const b = +F.buy.value; F.buy.style.setProperty('--p', `${(b / 5) * 100}%`);
  $('#oBuy').textContent = b ? `${b.toFixed(2)} SOL` : 'none';
  $('#lBuyNote').textContent = b ? `A ${b.toFixed(2)} SOL buy in the launch block pays the same 99% fee as anyone: ${(b * 0.99).toFixed(3)} SOL goes into the bounty and ${(b * 0.01).toFixed(3)} SOL buys tokens. Waiting two minutes gets you the 1% fee.` : "The creator buys at the same fee as everyone else. In the first seconds that's 99%, so most creators wait.";
  Object.entries(F).forEach(([k, el]) => (draft[k] = el.value)); store.set('helus:draft', draft);
}
Object.values(F).forEach(el => el.addEventListener('input', syncCard)); syncCard();
$('#lForm').addEventListener('submit', e => { e.preventDefault(); syncCard(); if (!F.name.value.trim() || !F.tick.value.trim()) { toast('Give your coin a name and a ticker first'); (F.name.value.trim() ? F.tick : F.name).focus(); return; } toast('Draft saved. Launches open when the helus config is live.'); $('#lState').classList.add('flash'); setTimeout(() => $('#lState').classList.remove('flash'), 1200); });

// the card's little orbit
const oCv = $('#oCv'); let oc, ow, oh;
function sizeCard() { const r = oCv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); ow = r.width; oh = r.height; oCv.width = ow * d; oCv.height = oh * d; oc = oCv.getContext('2d'); oc.setTransform(d, 0, 0, d, 0, 0); }
sizeCard(); addEventListener('resize', sizeCard);
(() => { let T = 0; const tick = () => { requestAnimationFrame(tick); if (document.hidden || !$('[data-view="launch"]').classList.contains('on')) return; T += 0.016; const c = oc; if (!c) return; c.clearRect(0, 0, ow, oh);
  const cx = ow * 0.5, cy = oh * 0.5; [0.62, 0.8, 0.98].forEach((k, i) => { c.setLineDash([2, 7]); c.strokeStyle = `rgba(156,208,255,${0.22 - i * 0.05})`; c.beginPath(); c.ellipse(cx, cy, ow * 0.5 * k, oh * 0.36 * k, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    for (let j = 0; j < 4 + i; j++) { const a = T * (0.5 - i * 0.12) + j * (Math.PI * 2 / (4 + i)); c.fillStyle = 'rgba(211,233,255,.7)'; c.fillRect(cx + Math.cos(a) * ow * 0.5 * k - 2.5, cy + Math.sin(a) * oh * 0.36 * k - 2.5, 5, 5); } });
  const p = 0.5 + 0.5 * Math.sin(T * 1.2); c.strokeStyle = `rgba(156,208,255,${0.35 * (1 - p)})`; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, cy, ow * 0.5 * (0.3 + p * 0.7), oh * 0.36 * (0.3 + p * 0.7), 0, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1;
}; requestAnimationFrame(tick); })();

// the card as a PNG
$('#lSave').addEventListener('click', () => {
  const W = 1200, H = 675, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const g = c.createRadialGradient(W * 0.75, H * 0.5, 40, W * 0.75, H * 0.5, 700); g.addColorStop(0, '#132240'); g.addColorStop(1, '#0a0e19'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.setLineDash([3, 10]); [220, 300, 380].forEach((r, i) => { c.strokeStyle = `rgba(156,208,255,${0.3 - i * 0.07})`; c.beginPath(); c.ellipse(W * 0.76, H * 0.5, r, r * 0.42, -0.2, 0, Math.PI * 2); c.stroke(); }); c.setLineDash([]);
  c.save(); c.beginPath(); c.arc(W * 0.76, H * 0.5, 120, 0, Math.PI * 2); c.clip(); c.drawImage(oImg, W * 0.76 - 120, H * 0.5 - 120, 240, 240); c.restore();
  c.strokeStyle = '#9cd0ff'; c.lineWidth = 3; c.beginPath(); c.arc(W * 0.76, H * 0.5, 122, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#9cd0ff'; c.font = '700 30px Pixelify'; c.fillText('helus', 64, 86);
  c.fillStyle = '#ecf4ff'; c.font = '700 74px Pixelify'; c.fillText((F.name.value.trim() || 'Your coin').slice(0, 18), 64, 200);
  c.fillStyle = '#9cd0ff'; c.font = '700 34px Pixelify'; c.fillText(`$${F.tick.value.trim() || 'TICKER'}`, 64, 252);
  c.fillStyle = '#c6d3e6'; c.font = '500 24px Inter'; const words = (F.desc.value.trim() || 'Get paid to hold.').split(' '); let line = '', y = 312; for (const w of words) { if (c.measureText(line + w).width > 560) { c.fillText(line, 64, y); line = ''; y += 34; } line += w + ' '; } c.fillText(line, 64, y);
  [['99% → 1%', 'fee in the first two minutes'], ['every 10 min', 'holders get paid in SOL'], ['1x → 3x', 'the longer you hold']].forEach(([a, b], i) => { const x = 64 + i * 200, yy = 520; c.fillStyle = '#ecf4ff'; c.font = '700 26px Pixelify'; c.fillText(a, x, yy); c.fillStyle = '#7f90ab'; c.font = '500 16px Inter'; c.fillText(b, x, yy + 28); });
  cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `helus-${(F.tick.value || 'card').toLowerCase()}.png`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); toast('Card saved'); }, 'image/png');
});

// ---------- replay ----------
const replay = mountReplay({ form: $('#rpForm'), input: $('#rpInput'), res: $('#rpRes'), paste: $('#rpPaste') });

// ---------- calculator: a month of payouts ----------
const A = { vol: $('#aVol'), bag: $('#aBag'), elig: $('#aElig'), avg: $('#aAvg') };
function drawCalc() {
  const V = +A.vol.value, B = +A.bag.value, E = +A.elig.value, M = +A.avg.value;
  Object.values(A).forEach(i => i.style.setProperty('--p', `${((i.value - i.min) / (i.max - i.min)) * 100}%`));
  $('#aoVol').textContent = `${V.toLocaleString('en-US')} SOL`; $('#aoBag').textContent = `${B.toFixed(2)}%`; $('#aoElig').textContent = `${E}%`; $('#aoAvg').textContent = `${M.toFixed(1)}x`;
  const perPayoutPool = (V * 0.01 * SPLIT.holders) / PAYOUTS_PER_DAY, pts = []; let sum = 0;
  for (let k = 0; k <= 30 * PAYOUTS_PER_DAY; k++) { const hrs = k / 6, m = mult(hrs); sum += perPayoutPool * Math.min(WALLET_CAP, (B * m) / (E * M)); if (k % 12 === 0) pts.push([hrs / 24, sum, m]); }
  $('#aTotal').textContent = fmtSol(sum); $('#aDay').textContent = fmtSol(perPayoutPool * PAYOUTS_PER_DAY * Math.min(WALLET_CAP, (B * 3) / (E * M)));
  const cv = $('#aCv'), r = cv.getBoundingClientRect(); if (!r.width) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  const w = r.width, h = r.height, x = t => 40 + (t / 30) * (w - 56), y = v => h - 28 - (v / (sum || 1)) * (h - 50), ym = m => h - 28 - ((m - 1) / 2) * (h - 50) * 0.35;
  c.fillStyle = 'rgba(156,208,255,.07)'; [0, 5, 10, 15, 20, 25, 30].forEach(t => { c.fillRect(x(t), 12, 1, h - 40); c.fillStyle = '#7f90ab'; c.font = '500 10px Mono, monospace'; c.fillText(`d${t}`, x(t) - 6, h - 10); c.fillStyle = 'rgba(156,208,255,.07)'; });
  const grad = c.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, 'rgba(156,208,255,.35)'); grad.addColorStop(1, 'rgba(156,208,255,0)');
  c.beginPath(); pts.forEach(([t, v], i) => (i ? c.lineTo(x(t), y(v)) : c.moveTo(x(t), y(v)))); c.lineTo(x(30), h - 28); c.lineTo(x(0), h - 28); c.closePath(); c.fillStyle = grad; c.fill();
  c.beginPath(); pts.forEach(([t, v], i) => (i ? c.lineTo(x(t), y(v)) : c.moveTo(x(t), y(v)))); c.strokeStyle = '#9cd0ff'; c.lineWidth = 3; c.stroke();
  c.beginPath(); pts.forEach(([t, , m], i) => (i ? c.lineTo(x(t), ym(m)) : c.moveTo(x(t), ym(m)))); c.strokeStyle = '#ff7d5c'; c.lineWidth = 2; c.setLineDash([4, 5]); c.stroke(); c.setLineDash([]);
}
Object.values(A).forEach(i => i.addEventListener('input', drawCalc)); addEventListener('resize', drawCalc);

// ---------- coins in orbit: nothing yet, said plainly ----------
(() => { const cv = $('#emptyCv'), c = cv.getContext('2d'); let T = 0; const tick = () => { requestAnimationFrame(tick); if (!$('[data-view="orbit"]').classList.contains('on')) return; const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (cv.width !== Math.round(r.width * d)) { cv.width = r.width * d; cv.height = r.height * d; } c.setTransform(d, 0, 0, d, 0, 0); T += 0.016; const w = r.width, h = r.height; c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2; [0.3, 0.42].forEach((k, i) => { c.setLineDash([2, 7]); c.strokeStyle = 'rgba(156,208,255,.25)'; c.beginPath(); c.ellipse(cx, cy, w * k, h * k * 0.5, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); });
  c.fillStyle = 'rgba(156,208,255,.18)'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2); c.fill(); const a = T * 0.6; c.fillStyle = '#ecf4ff'; c.fillRect(cx + Math.cos(a) * w * 0.42 - 4, cy + Math.sin(a) * h * 0.21 - 4, 8, 8);
}; requestAnimationFrame(tick); })();

addEventListener('hashchange', route); route();
