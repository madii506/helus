// helus home: the orbit world behind the page, smooth scroll, the altimeter, and every animated section.
import { $, $$, toast } from './util.js';
import { mountReplay } from './replay.js?v=1';
import { feeAt, mult, payoutEstimate, fmtSol } from './model.js?v=1';
import { mountSim } from './sim.js?v=1';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 980px)').matches;
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ duration: 1.1, smoothWheel: true, wheelMultiplier: 0.95 });
  const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
}
const go = (h, offset = 0) => { const el = $(h); if (!el) return; if (lenis) lenis.scrollTo(el, { offset, duration: 1.4 }); else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); };
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => { const h = a.getAttribute('href'); if (h.length > 1 && $(h)) { e.preventDefault(); go(h); } }));

// ---------- the intro film (no words), then the world behind the page ----------
const html = document.documentElement;
let orbit = null, introDone = false;
const seen = (() => { try { return sessionStorage.getItem('helus:intro') === '1'; } catch { return false; } })();
function endIntro() {
  if (introDone) return; introDone = true; html.classList.remove('intro'); if (lenis) lenis.start();
  try { sessionStorage.setItem('helus:intro', '1'); } catch { }
  ['wheel', 'touchstart', 'keydown'].forEach(t => removeEventListener(t, skip, { capture: true }));
  setTimeout(onScroll, 0);
  neon();
}

// ---------- the wordmark flickers like a neon tube that's almost fixed ----------
function neon() {
  const ls = $$('.word span'); if (reduced || !ls.length) return;
  let live = true;
  new IntersectionObserver(([e]) => (live = e.isIntersecting)).observe($('#top'));
  const set = (els, c) => els.forEach(l => { l.classList.remove('off', 'dim'); if (c) l.classList.add(c); });
  const burst = () => {
    if (!live || document.hidden) return setTimeout(burst, 1200);
    const r = Math.random();
    const pick = r < 0.18 ? ls : r < 0.55 ? [ls[1]] : [ls[(Math.random() * ls.length) | 0]];   // the e is the tube that's going
    let t = 0;
    for (let i = 0, n = 2 + ((Math.random() * 4) | 0); i < n; i++) {
      const off = 35 + Math.random() * 110, on = 45 + Math.random() * 170, c = Math.random() < 0.7 ? 'off' : 'dim';
      setTimeout(() => set(pick, c), t); t += off;
      setTimeout(() => set(pick, null), t); t += on;
    }
    setTimeout(burst, t + 800 + Math.random() * 3200);
  };
  setTimeout(burst, 2200);
}
function skip(e) { if (e && e.type === 'keydown' && ['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return; if (orbit && orbit.introProgress < 1) orbit.skipIntro(); else endIntro(); }
if (lenis) lenis.stop();
$('#skipIntro').addEventListener('click', skip);
['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, skip, { capture: true, passive: true }));
setTimeout(endIntro, 14000);                                   // backstop: the page never stays locked
(async () => {
  let gl = false; try { gl = !!document.createElement('canvas').getContext('webgl2'); } catch { }
  if (!gl) return endIntro();
  try { const { createOrbit } = await import('./orbit.js?v=1'); orbit = createOrbit($('#orbit'), { mobile, reduced }); window.helusOrbit = orbit; }
  catch (e) { console.warn('orbit', e); return endIntro(); }
  await document.fonts.ready;
  if (reduced || seen) { orbit.start(); endIntro(); return; }
  orbit.playIntro(endIntro);
  const ring = $('#skP'); const tick = () => { if (introDone) return; ring.style.strokeDashoffset = 132 * (1 - orbit.introProgress); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
})();

// ---------- words that arrive, blocks that rise ----------
$$('.split-words').forEach(el => {
  const walk = n => { [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) { const f = document.createDocumentFragment(); c.textContent.split(/(\s+)/).forEach(t => { if (!t) return; if (/^\s+$/.test(t)) f.append(t); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = t; f.append(s); } }); c.replaceWith(f); }
    else if (c.nodeType === 1) walk(c);
  }); };
  walk(el); $$('.w', el).forEach((w, i) => (w.style.transitionDelay = `${i * 0.055}s`));
});
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
$$('.rv, .split-words').forEach(el => io.observe(el));

const hudFee = $('#hudFee'), hudBounty = $('#hudBounty'), hudNext = $('#hudNext');
function storyHud(s, k) {
  const t = s <= 0 ? 0 : s === 1 ? k * 120 : 120;
  hudFee.textContent = `${(feeAt(t) * 100).toFixed(1)}%`;
  const b = s < 1 ? 0 : s === 1 ? 38 * (1 - Math.pow(1 - k, 2)) : 38 + (s - 2 + k) * 4;
  hudBounty.textContent = `${b.toFixed(2)} SOL`;
  const n = s < 3 ? 600 : Math.max(0, 600 - ((s - 3 + k) * 600) % 600);
  hudNext.textContent = `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
}

// ---------- nav, altimeter, the story pin ----------
const nav = $('#nav'), altBar = $('#alt .alt-bar i'), altKm = $('#altKm');
const links = $$('.nav-links a[href^="#"]'), ids = links.map(a => a.getAttribute('href').slice(1));
const pin = $('#storyPin'), steps = $$('.step'), bars = $$('#storyBar b'), cvs = $('#orbit');
let lastY = 0, curStep = -1;
function onScroll() {
  const y = scrollY, H = document.documentElement.scrollHeight - innerHeight, p = H > 0 ? Math.min(1, y / H) : 0;
  nav.classList.toggle('solid', y > 40); nav.classList.toggle('hide', y > lastY + 4 && y > 600); if (y < lastY - 4) nav.classList.remove('hide'); lastY = y;
  altBar.style.height = `${p * 100}%`; altKm.textContent = String(Math.round(p * 420)).padStart(3, '0');
  let on = ''; for (const id of ids) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < innerHeight * 0.45) on = id; }
  links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + on));
  // the story: six steps across the pinned stretch
  const r = pin.getBoundingClientRect(), span = r.height - innerHeight;
  const sp = Math.max(0, Math.min(0.9999, -r.top / span));
  const inStory = r.top < innerHeight * 0.3 && r.bottom > innerHeight * 0.7;
  const s = Math.floor(sp * 6), k = sp * 6 - s;
  if (s !== curStep) { curStep = s; steps.forEach((el, i) => el.classList.toggle('on', i === s)); }
  bars.forEach((b, i) => b.style.setProperty('--k', i < s ? 1 : i === s ? k : 0));
  if (orbit) { if (inStory) orbit.setStory(s, k); else orbit.clearStory(); orbit.setScroll(Math.max(0, (r.bottom < 0 ? -r.bottom / innerHeight : 0) * 0.2)); }
  document.body.classList.toggle('deep', r.bottom < innerHeight * 0.4);
  // the planet leads in the hero and the story, and steps back behind everything else
  const storyOn = r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.45;
  cvs.style.opacity = y < innerHeight * 0.55 || storyOn ? 1 : r.top > 0 ? 0.28 : 0.14;
  storyHud(s, k);
}
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ---------- only animate what's on screen ----------
function whenVisible(el, start, stop) { new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? start() : stop())), { rootMargin: '80px' }).observe(el); }
function loop(fn) { let id = 0, on = false, last = 0; const f = t => { if (!on) return; const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; fn(dt, t / 1000); id = requestAnimationFrame(f); }; return { start() { if (!on) { on = true; last = 0; id = requestAnimationFrame(f); } }, stop() { on = false; cancelAnimationFrame(id); } }; }
function fit(cv) { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return { c, w: r.width, h: r.height }; }

// ---------- 01: a typical launch's first two minutes (an illustration) ----------
(() => {
  const cv = $('#raceCv'), tEl = $('#raceT'); let ctx = fit(cv), T = 0;
  const rng = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
  const ev = [];
  for (let i = 0; i < 22; i++) ev.push({ t: rng() * 1.6, kind: 'snipe', s: 0.6 + rng() * 0.9 });
  for (let i = 0; i < 46; i++) ev.push({ t: 4 + rng() * 112, kind: 'hold', s: 0.25 + rng() * 0.5 });
  for (let i = 0; i < 16; i++) ev.push({ t: 14 + rng() * 70, kind: 'dump', s: 0.5 + rng() * 1.0 });
  addEventListener('resize', () => (ctx = fit(cv)));
  const L = loop(dt => {
    T += dt * 24; if (T > 150) T = 0;
    const { c, w, h } = ctx; c.clearRect(0, 0, w, h);
    const x = t => 30 + (t / 120) * (w - 44), mid = h * 0.52;
    c.fillStyle = 'rgba(156,208,255,.08)'; for (let s = 0; s <= 120; s += 15) c.fillRect(x(s), 10, 1, h - 30);
    c.fillStyle = 'rgba(156,208,255,.22)'; c.fillRect(30, mid, w - 44, 1);
    c.font = '500 10px Mono, monospace'; c.fillStyle = 'rgba(127,144,171,.9)'; [0, 30, 60, 90, 120].forEach(s => c.fillText(`${s}s`, x(s) - 6, h - 6));
    for (const e of ev) {
      if (e.t > Math.min(T, 120)) continue;
      const age = Math.min(1, (T - e.t) / 6), size = 7 + e.s * 9, X = x(e.t);
      const up = e.kind !== 'dump', Y = up ? mid - 6 - size * (0.6 + (e.s * 13) % 4) : mid + 6 + size * (0.4 + (e.s * 7) % 3);
      c.globalAlpha = Math.min(1, age * 2);
      c.fillStyle = e.kind === 'snipe' ? '#ff7d5c' : e.kind === 'hold' ? '#9cd0ff' : '#6b5560';
      c.fillRect(Math.round(X - size / 2), Math.round(Y - size / 2), Math.round(size), Math.round(size));
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(Math.round(X - size / 2), Math.round(Y - size / 2), Math.round(size), 2);
    }
    c.globalAlpha = 1; c.fillStyle = '#ecf4ff'; c.fillRect(x(Math.min(T, 120)), 6, 2, h - 26);
    const s = Math.min(120, Math.floor(T)); tEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });
  whenVisible(cv, L.start, L.stop);
})();

// ---------- 03: the fee curve ----------
(() => {
  const svg = $('#curveSvg'), tip = $('#curveTip'), box = svg.parentElement;
  const W = 1000, Hh = 420, PX = 40, PY = 30, x = t => PX + (t / 140) * (W - PX - 10), y = f => PY + (1 - f) * (Hh - PY - 40);
  let d = ''; for (let t = 0; t <= 140; t += 0.5) d += `${t ? 'L' : 'M'}${x(t).toFixed(1)},${y(feeAt(t)).toFixed(1)}`;
  const grid = [0, 0.25, 0.5, 0.75, 0.99].map(f => `<line x1="${PX}" x2="${W - 10}" y1="${y(f)}" y2="${y(f)}" stroke="rgba(156,208,255,.09)"/><text x="${PX - 8}" y="${y(f) + 4}" text-anchor="end" fill="#7f90ab" font-family="Mono,monospace" font-size="13">${Math.round(f * 100)}%</text>`).join('');
  const ticks = [0, 30, 60, 90, 120].map(t => `<text x="${x(t)}" y="${Hh - 8}" text-anchor="middle" fill="#7f90ab" font-family="Mono,monospace" font-size="13">${t ? (t >= 60 ? `${t / 60}m` : `${t}s`) : 'launch'}</text>`).join('');
  svg.innerHTML = `<defs><linearGradient id="cg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff7d5c" stop-opacity=".35"/><stop offset="1" stop-color="#9cd0ff" stop-opacity="0"/></linearGradient></defs>${grid}${ticks}
    <path d="${d}L${x(140)},${y(0)}L${x(0)},${y(0)}Z" fill="url(#cg)"/><path id="cPath" d="${d}" fill="none" stroke="#9cd0ff" stroke-width="3.5" stroke-linejoin="round"/>
    <line id="cLine" y1="${PY - 10}" y2="${Hh - 30}" stroke="#ecf4ff" stroke-width="1.5" stroke-dasharray="4 5"/><rect id="cDot" width="16" height="16" rx="3" fill="#ecf4ff" stroke="#0a0e19" stroke-width="3"/>`;
  const path = $('#cPath'), len = path.getTotalLength(); path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
  new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { path.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.3,.7,.2,1)'; path.style.strokeDashoffset = 0; o.disconnect(); } }), { threshold: 0.3 }).observe(svg);
  const line = $('#cLine'), dot = $('#cDot'), out = { t: $('#crT'), f: $('#crF'), k: $('#crK'), b: $('#crB') };
  function set(t) {
    t = Math.max(0, Math.min(140, t)); const f = feeAt(t), X = x(t), Y = y(f);
    line.setAttribute('x1', X); line.setAttribute('x2', X); dot.setAttribute('x', X - 8); dot.setAttribute('y', Y - 8);
    const s = Math.round(t); out.t.textContent = t < 1 ? 'block 0' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    out.f.textContent = `${(f * 100).toFixed(f < 0.1 ? 1 : 0)}%`; out.k.textContent = `${(1 - f).toFixed(2)} SOL`; out.b.textContent = `${f.toFixed(2)} SOL`;
    const r = box.getBoundingClientRect(); tip.style.left = `${22 + (X / W) * (r.width - 44)}px`; tip.textContent = `${(f * 100).toFixed(f < 0.1 ? 1 : 0)}% fee`;
    $$('.presets button').forEach(b => b.classList.toggle('on', Number(b.dataset.t) === Math.round(t)));
  }
  const fromEvent = e => { const r = svg.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; return ((px - PX) / (W - PX - 10)) * 140; };
  let drag = false;
  box.addEventListener('pointerdown', e => { drag = true; box.setPointerCapture(e.pointerId); set(fromEvent(e)); });
  box.addEventListener('pointermove', e => { if (drag || e.pointerType === 'mouse') set(fromEvent(e)); });
  box.addEventListener('pointerup', () => (drag = false));
  $$('.presets button').forEach(b => b.addEventListener('click', () => { const to = Number(b.dataset.t), from = cur; const t0 = performance.now(); const step = n => { const k = Math.min(1, (n - t0) / 500); cur = from + (to - from) * (1 - Math.pow(1 - k, 3)); set(cur); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }));
  let cur = 2; set(cur); addEventListener('resize', () => set(cur));
  box.addEventListener('pointermove', e => (cur = Math.max(0, Math.min(140, fromEvent(e)))));
})();

// ---------- 04: where the fee goes, as a stream of particles ----------
(() => {
  const svg = $('#flowSvg');
  const NODES = { fee: [130, 230, 'every fee'], met: [560, 400, 'Meteora · 20%'], hold: [930, 90, 'holders · 40%'], cre: [930, 230, 'creator · 24%'], hel: [930, 370, '$HELUS holders · 16%'] };
  const paths = [['fee', 'hold', 0.4, '#9cd0ff'], ['fee', 'cre', 0.24, '#d3e9ff'], ['fee', 'hel', 0.16, '#4c9dff'], ['fee', 'met', 0.2, '#5b6a83']];
  const cpath = (a, b) => { const [x1, y1] = NODES[a], [x2, y2] = NODES[b]; const mx = (x1 + x2) / 2; return `M${x1 + 70},${y1}C${mx},${y1} ${mx},${y2} ${x2 - 90},${y2}`; };
  svg.innerHTML = paths.map(([a, b, , c], i) => `<path id="fp${i}" d="${cpath(a, b)}" fill="none" stroke="${c}" stroke-opacity=".28" stroke-width="${2 + i % 2}" stroke-dasharray="3 7"/>`).join('') +
    Object.entries(NODES).map(([k, [x, y, t]]) => `<g transform="translate(${x},${y})"><rect x="${k === 'fee' ? -70 : -90}" y="-24" width="${k === 'fee' ? 140 : 180}" height="48" rx="12" fill="${k === 'fee' ? '#9cd0ff' : 'rgba(10,14,25,.9)'}" stroke="${k === 'fee' ? 'none' : 'rgba(156,208,255,.3)'}"/><text text-anchor="middle" y="6" font-family="Pixelify,monospace" font-weight="700" font-size="16" fill="${k === 'fee' ? '#071021' : '#ecf4ff'}">${t}</text></g>`).join('') + '<g id="fpDots"></g>';
  const dots = $('#fpDots'), els = paths.map((_, i) => $(`#fp${i}`)), lens = els.map(e => e.getTotalLength());
  const parts = [];
  const L = loop(dt => {
    if (Math.random() < dt * 22) { const r = Math.random(); let acc = 0, i = 0; for (; i < paths.length; i++) { acc += paths[i][2]; if (r < acc) break; } parts.push({ i: Math.min(i, 3), k: 0, s: 3 + Math.random() * 3 }); }
    let html = '';
    for (let j = parts.length - 1; j >= 0; j--) {
      const p = parts[j]; p.k += dt * 0.45; if (p.k >= 1) { parts.splice(j, 1); continue; }
      const pt = els[p.i].getPointAtLength(p.k * lens[p.i]);
      html += `<rect x="${(pt.x - p.s / 2).toFixed(1)}" y="${(pt.y - p.s / 2).toFixed(1)}" width="${p.s}" height="${p.s}" fill="${paths[p.i][3]}" opacity="${Math.min(1, (1 - p.k) * 3).toFixed(2)}"/>`;
    }
    dots.innerHTML = html;
  });
  whenVisible(svg, L.start, L.stop);
})();

// ---------- 05: a tiny pixel loop for each rule ----------
(() => {
  const draws = {
    burn(c, w, h, t) {                                         // ember cubes dive at the planet edge and flare
      c.fillStyle = 'rgba(156,208,255,.9)'; for (let x = 0; x < w; x += 6) { const y = h - 18 + Math.sin(x * 0.05) * 2; c.fillRect(x, y, 5, 18); }
      for (let i = 0; i < 5; i++) { const k = (t * 0.6 + i / 5) % 1, x = 20 + i * (w - 40) / 4, y = 8 + k * (h - 30);
        if (k < 0.82) { c.fillStyle = '#ff7d5c'; c.fillRect(x, y, 7, 7); c.fillStyle = 'rgba(255,154,116,.4)'; c.fillRect(x + 1, y - 9, 5, 7); }
        else { const f = (k - 0.82) / 0.18; c.fillStyle = `rgba(255,176,143,${1 - f})`; for (let j = 0; j < 6; j++) c.fillRect(x + Math.cos(j) * f * 16, h - 24 - Math.sin(j * 2) * f * 12, 3, 3); } }
    },
    bundle(c, w, h, t) {                                       // one funder feeds many wallets; only the first lights up
      const fx = 24, fy = h / 2; c.fillStyle = '#ff7d5c'; c.fillRect(fx - 7, fy - 7, 14, 14);
      for (let i = 0; i < 6; i++) { const y = 14 + i * (h - 28) / 5, x = w - 30, k = Math.min(1, ((t * 0.7) % 1.6) * 1.6 - i * 0.12);
        c.strokeStyle = 'rgba(156,208,255,.18)'; c.beginPath(); c.moveTo(fx, fy); c.lineTo(x, y); c.stroke();
        if (k > 0) { c.fillStyle = '#9cd0ff'; c.fillRect(fx + (x - fx) * Math.min(1, k) - 2, fy + (y - fy) * Math.min(1, k) - 2, 4, 4); }
        c.fillStyle = i === 0 ? '#ecf4ff' : 'rgba(127,144,171,.5)'; c.fillRect(x - 5, y - 5, 10, 10); }
    },
    climb(c, w, h, t) {                                        // a holder climbs 1x, 2x, 3x, then sells and drops
      const k = (t * 0.25) % 1, lvl = k < 0.25 ? 0 : k < 0.5 ? 1 : k < 0.85 ? 2 : -1;
      ['1x', '2x', '3x'].forEach((s, i) => { const y = h - 20 - i * (h - 40) / 2; c.fillStyle = 'rgba(156,208,255,.15)'; c.fillRect(30, y, w - 50, 2); c.fillStyle = '#7f90ab'; c.font = '700 11px Pixelify'; c.fillText(s, 6, y + 4); });
      const y = lvl < 0 ? h - 20 + Math.min(1, (k - 0.85) / 0.15) * 0 : h - 20 - lvl * (h - 40) / 2;
      const x = 40 + ((t * 40) % (w - 80));
      c.fillStyle = lvl < 0 ? '#ff7d5c' : '#ecf4ff'; c.fillRect(x, (lvl < 0 ? h - 26 : y - 12), 10, 10);
    },
    cap(c, w, h, t) {                                          // a payout split into bars; the whale's bar stops at the cap line
      const n = 9, bw = (w - 30) / n, capY = h * 0.38;
      for (let i = 0; i < n; i++) { const want = i === 4 ? h * 0.85 : (0.25 + ((i * 37) % 10) / 22) * h; const k = Math.min(1, (t * 0.8 % 2)); const bh = Math.min(want * k, i === 4 ? h - capY - 8 : want * k);
        c.fillStyle = i === 4 ? '#ecf4ff' : '#9cd0ff'; c.fillRect(15 + i * bw + 2, h - 8 - bh, bw - 5, bh); }
      c.fillStyle = '#ff7d5c'; c.fillRect(10, capY, w - 20, 2); c.font = '700 10px Mono'; c.fillText('2% cap', w - 52, capY - 5);
    },
    lock(c, w, h, t) {                                         // the creator's 3% unlocks over 30 days; a lock on the liquidity
      c.fillStyle = 'rgba(156,208,255,.12)'; c.fillRect(16, h / 2 - 7, w - 32, 14);
      const k = (t * 0.12) % 1; c.fillStyle = '#9cd0ff'; c.fillRect(16, h / 2 - 7, (w - 32) * k, 14);
      c.fillStyle = '#7f90ab'; c.font = '500 10px Mono'; c.fillText('day 0', 16, h / 2 + 24); c.fillText('day 30', w - 56, h / 2 + 24);
      const lx = w / 2 - 9, ly = 10; c.fillStyle = '#ecf4ff'; c.fillRect(lx, ly + 10, 18, 14); c.strokeStyle = '#ecf4ff'; c.lineWidth = 3; c.beginPath(); c.arc(lx + 9, ly + 10, 6, Math.PI, 0); c.stroke();
    },
  };
  $$('.rule-cv').forEach(cv => {
    let ctx = fit(cv); addEventListener('resize', () => (ctx = fit(cv)));
    const f = draws[cv.dataset.anim]; let T = 0;
    const L = loop(dt => { T += dt; const { c, w, h } = ctx; c.clearRect(0, 0, w, h); f(c, w, h, T); });
    whenVisible(cv, L.start, L.stop);
  });
})();

// ---------- 06: three rings and a holder climbing them (a day, sped up) ----------
(() => {
  const cv = $('#ringsCv'), tEl = $('#ringsT'), mEl = $('#ringsM'), lads = $$('.lad'); let ctx = fit(cv), T = 0;
  addEventListener('resize', () => (ctx = fit(cv)));
  const L = loop(dt => {
    T += dt; const { c, w, h } = ctx, cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 16;
    c.clearRect(0, 0, w, h);
    const hours = (T * 2.2) % 36, m = mult(hours), radii = [R * 0.55, R * 0.77, R * 0.98];
    radii.forEach((r, i) => { const on = m >= 1 + i - 0.001; c.strokeStyle = on ? 'rgba(156,208,255,.55)' : 'rgba(156,208,255,.14)'; c.setLineDash([3, 7]); c.lineWidth = on ? 2 : 1.5; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = on ? '#9cd0ff' : '#5b6a83'; c.font = '700 12px Pixelify'; c.fillText(`${i + 1}x`, cx + r + 6 > w - 20 ? cx - 10 : cx + 4, cy - r - 6); });
    const r = radii[0] + (radii[2] - radii[0]) * Math.min(1, (m - 1) / 2), a = T * 0.9;
    for (let k = 1; k < 10; k++) { const aa = a - k * 0.05; c.fillStyle = `rgba(156,208,255,${0.5 - k * 0.05})`; c.fillRect(cx + Math.cos(aa) * r - 3, cy + Math.sin(aa) * r - 3, 6, 6); }
    c.fillStyle = '#ecf4ff'; c.fillRect(cx + Math.cos(a) * r - 6, cy + Math.sin(a) * r - 6, 12, 12);
    // other holders, at their own heights
    for (let i = 0; i < 18; i++) { const rr = radii[i % 3], aa = i * 2.1 + T * (0.5 - (i % 3) * 0.12); c.fillStyle = 'rgba(211,233,255,.55)'; c.fillRect(cx + Math.cos(aa) * rr - 3, cy + Math.sin(aa) * rr - 3, 6, 6); }
    tEl.textContent = `${Math.floor(hours)}h`; mEl.textContent = `${m.toFixed(1)}x`;
    lads.forEach((l, i) => l.classList.toggle('on', i === (m >= 3 ? 2 : m >= 2 ? 1 : 0)));
  });
  whenVisible(cv, L.start, L.stop);
})();

// ---------- 07: the calculator ----------
(() => {
  const vol = $('#cVol'), bag = $('#cBag'), hrs = $('#cHrs');
  const fill = i => i.style.setProperty('--p', `${((i.value - i.min) / (i.max - i.min)) * 100}%`);
  function run() {
    [vol, bag, hrs].forEach(fill);
    const V = +vol.value, B = +bag.value, Hh = +hrs.value, m = mult(Hh);
    $('#oVol').textContent = `${V.toLocaleString('en-US')} SOL`; $('#oBag').textContent = `${B.toFixed(2)}% of supply`; $('#oHrs').textContent = `${Hh} h · ${m.toFixed(1)}x`;
    const e = payoutEstimate({ volume: V, bagPct: B, hours: Hh });
    $('#rPay').textContent = fmtSol(e.perPayout); $('#rDay').textContent = fmtSol(e.perDay); $('#rMonth').textContent = fmtSol(e.perMonth);
  }
  [vol, bag, hrs].forEach(i => i.addEventListener('input', run)); run();
})();

// ---------- the simulator ----------
mountSim($('#simBox'));

// ---------- who it's for: tabs, each with its own little picture ----------
(() => {
  const tabs = $$('.who-tabs button'), panes = $$('.who-pane');
  tabs.forEach(b => b.addEventListener('click', () => { const i = +b.dataset.w; tabs.forEach((x, j) => x.classList.toggle('on', j === i)); panes.forEach((p, j) => p.classList.toggle('on', j === i)); }));
  const pics = {
    0(c, w, h, t) {                                          // a wallet in orbit catching payout drops
      const cx = w / 2, cy = h / 2; c.setLineDash([2, 7]); c.strokeStyle = 'rgba(156,208,255,.3)'; c.beginPath(); c.ellipse(cx, cy, w * 0.38, h * 0.28, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#9fd2ff'; c.beginPath(); c.arc(cx, cy, 42, 0, Math.PI * 2); c.fill();
      const a = t * 0.7, x = cx + Math.cos(a) * w * 0.38, y = cy + Math.sin(a) * h * 0.28; c.fillStyle = '#8ff0c8'; c.fillRect(x - 8, y - 8, 16, 16);
      for (let i = 0; i < 6; i++) { const k = (t * 0.8 + i / 6) % 1, px = cx + (x - cx) * k, py = cy + (y - cy) * k; c.fillStyle = `rgba(156,208,255,${1 - k})`; c.fillRect(px - 3, py - 3, 6, 6); }
      c.fillStyle = '#ecf4ff'; c.font = '800 15px Inter'; const lbl = '+ SOL every 10 min', lw = c.measureText(lbl).width; c.fillText(lbl, x + 14 + lw > w - 6 ? x - 14 - lw : x + 14, y - 10);
    },
    1(c, w, h, t) {                                          // a creator's 24% stream, steady
      const n = 30; for (let i = 0; i < n; i++) { const bh = 30 + (Math.sin(i * 0.7 + t * 1.5) * 0.5 + 0.5) * (h * 0.45); c.fillStyle = i % 4 === 0 ? '#ecf4ff' : '#4c9dff'; c.fillRect(20 + i * (w - 40) / n, h - 30 - bh, (w - 40) / n - 4, bh); }
      c.fillStyle = '#ecf4ff'; c.font = '800 15px Inter'; c.fillText('24% of every fee, for as long as it trades', 20, 28);
    },
    2(c, w, h, t) {                                          // many coins, one stream into $HELUS
      const cx = w * 0.78, cy = h / 2; c.fillStyle = '#9cd0ff'; c.beginPath(); c.arc(cx, cy, 36, 0, Math.PI * 2); c.fill(); c.fillStyle = '#071021'; c.font = '700 16px Pixelify'; c.fillText('$HELUS', cx - 30, cy + 6);
      for (let i = 0; i < 7; i++) { const y0 = 30 + i * (h - 60) / 6, x0 = 40; c.fillStyle = 'rgba(211,233,255,.8)'; c.fillRect(x0 - 8, y0 - 8, 16, 16);
        for (let k = 0; k < 4; k++) { const f = (t * 0.5 + k / 4 + i * 0.13) % 1, px = x0 + (cx - 40 - x0) * f, py = y0 + (cy - y0) * f; c.fillStyle = `rgba(156,208,255,${1 - f * 0.6})`; c.fillRect(px - 2.5, py - 2.5, 5, 5); } }
    },
  };
  $$('.who-cv').forEach(cv => { let ctx = fit(cv), T = 0; addEventListener('resize', () => (ctx = fit(cv))); const f = pics[cv.dataset.who];
    const L = loop(dt => { if (!cv.offsetParent) return; if (!ctx.w) ctx = fit(cv); T += dt; const { c, w, h } = ctx; c.clearRect(0, 0, w, h); f(c, w, h, T); }); whenVisible(cv.closest('.who'), L.start, L.stop); });
})();

// ---------- one payout, step by step ----------
(() => {
  const box = $('#roundBox'), steps = $$('.rd', box), fill = $('.rd-fill', box), dot = $('.rd-dot', box); let T = 0;
  const L = loop(dt => { T += dt; const k = (T / 8) % 1, i = Math.min(4, Math.floor(k * 5)); fill.style.width = `${k * 100}%`; dot.style.left = `${k * 100}%`; steps.forEach((s, j) => s.classList.toggle('on', j === i)); });
  whenVisible(box, L.start, L.stop);
})();

// ---------- the numbers count up when they arrive ----------
(() => {
  const o = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; o.unobserve(e.target); const b = $('b', e.target), to = +b.dataset.n, suf = b.dataset.suf, t0 = performance.now();
    const f = n => { const k = Math.min(1, (n - t0) / 1100), v = to * (1 - Math.pow(1 - k, 3)); b.textContent = `${Math.round(v)}${suf}`; if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }), { threshold: 0.4 });
  $$('.pm').forEach(el => o.observe(el));
})();

// ---------- 08: replay ----------
mountReplay({ form: $('#rpForm'), input: $('#rpInput'), res: $('#rpRes'), paste: $('#rpPaste') });

// ---------- magnetic buttons ----------
if (!mobile && !reduced) $$('.mag').forEach(b => {
  b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.25}px)`; });
  b.addEventListener('pointerleave', () => (b.style.transform = ''));
});
window.helusToast = toast;
