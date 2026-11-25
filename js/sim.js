// The helus simulator: one hour of a test launch, run in the browser. Bots rush the first seconds and pay the
// curve; holders arrive, climb their orbits and get paid every 10 minutes; the visitor can buy and sell at any
// moment. Every wallet here is simulated, and the page says so.
import { feeAt, mult, SPLIT, WALLET_CAP } from './model.js?v=1';

const SUPPLY = 1e9, HOUR = 3600;
export function mountSim(root) {
  const $ = s => root.querySelector(s);
  const cv = $('.sim-cv'), c = cv.getContext('2d');
  let W = 0, H = 0;
  const size = () => { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener('resize', size);

  let S = null, speed = 1, running = false, raf = 0, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function fresh() {
    return { t: 0, vSol: 30, vTok: 1.073e9, bounty: 0, unpaid: 0, paid: 0, payouts: 0, nextPay: 600, burnt: 0, wallets: [], bursts: [], pulse: -1, log: [],
      you: { tokens: 0, since: null, feePaid: 0, got: 0, sniper: false, spent: 0 }, nextHolder: rnd(125, 160), done: false, bots: 14 };
  }
  function buy(w, sol) {
    const fee = feeAt(S.t), into = sol * (1 - fee), k = S.vSol * S.vTok;
    const out = S.vTok - k / (S.vSol + into); S.vSol += into; S.vTok -= out;
    S.bounty += sol * fee; S.unpaid += sol * fee * SPLIT.holders;
    return { tokens: out, fee, feePaid: sol * fee };
  }
  function sell(tokens) {
    const k = S.vSol * S.vTok, solOut = S.vSol - k / (S.vTok + tokens); S.vTok += tokens; S.vSol -= solOut;
    const fee = feeAt(S.t) * solOut; S.bounty += fee; S.unpaid += fee * SPLIT.holders; return solOut - fee;
  }
  const say = (s, cls = '') => { S.log.unshift({ t: S.t, s, cls }); S.log.length = Math.min(S.log.length, 7); drawLog(); };
  const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function step(dt) {                                         // dt in simulated seconds
    const t0 = S.t; S.t = Math.min(HOUR, S.t + dt);
    // bots, all inside the first six seconds
    while (S.bots > 0 && S.t >= (14 - S.bots) * 0.42) {
      S.bots--; const sol = rnd(1.5, 9), r = buy(null, sol);
      S.wallets.push({ id: `bot-${String(14 - S.bots).padStart(2, '0')}`, bot: true, tokens: r.tokens, since: S.t, a: rnd(0, 6.28), dying: 0, sniper: true });
      S.bursts.push({ a: rnd(0, 6.28), k: 0 }); S.burnt++;
      say(`bot-${String(14 - S.bots).padStart(2, '0')} bought ${sol.toFixed(2)} SOL at a ${(r.fee * 100).toFixed(0)}% fee: ${r.feePaid.toFixed(2)} SOL into the bounty`, 'hot');
    }
    // holders arrive after the curve
    while (S.t >= S.nextHolder) {
      const sol = Math.min(6, Math.exp(rnd(-1.6, 1.4))), r = buy(null, sol), id = `holder-${String(S.wallets.filter(w => !w.bot).length + 1).padStart(2, '0')}`;
      S.wallets.push({ id, tokens: r.tokens, since: S.nextHolder, a: rnd(0, 6.28), hold: rnd(400, 5000), dying: 0, sniper: S.nextHolder <= 120 });
      if (S.wallets.length < 60 && Math.random() < 0.35) say(`${id} bought ${sol.toFixed(2)} SOL at a ${(r.fee * 100).toFixed(1)}% fee`);
      S.nextHolder += rnd(18, 70);
    }
    // some sell: bots dump early, holders after their hold time
    for (const w of S.wallets) {
      if (w.dying || !w.tokens) continue;
      if ((w.bot && S.t > 20 && Math.random() < dt * 0.02) || (!w.bot && S.t - w.since > w.hold && Math.random() < dt * 0.002)) {
        const got = sell(w.tokens); w.tokens = 0; w.dying = 1;
        if (!w.bot || Math.random() < 0.5) say(`${w.id} sold for ${got.toFixed(2)} SOL and fell out of orbit`, 'dim');
      }
    }
    // payouts every 10 minutes
    if (S.t >= S.nextPay) {
      const pool = S.unpaid; S.unpaid = 0; S.nextPay += 600; S.payouts++;
      const el = S.wallets.filter(w => w.tokens > 0 && !w.sniper && !w.bot);
      const youIn = S.you.tokens > 0 && !S.you.sniper;
      const wt = w => w.tokens * mult((S.t - w.since) / 3600 * 1);
      const yw = youIn ? S.you.tokens * mult((S.t - S.you.since) / 3600) : 0;
      const tot = el.reduce((a, w) => a + wt(w), 0) + yw; let given = 0;
      if (tot > 0) {                                           // the 2% cap: whatever is above it carries into the next payout
        for (const w of el) { given += pool * Math.min(WALLET_CAP, wt(w) / tot); w.glow = 1; }
        if (youIn) { const g = pool * Math.min(WALLET_CAP, yw / tot); S.you.got += g; given += g; }
      }
      S.unpaid += pool - given; S.paid += given; S.pulse = 0;
      say(`payout ${S.payouts}: ${given.toFixed(3)} SOL to ${el.length + (youIn ? 1 : 0)} holders${youIn ? ', including you' : ''}`, 'pay');
    }
    if (S.t >= HOUR && !S.done) { S.done = true; running = false; finish(); }
  }

  // ---------- drawing ----------
  function draw() {
    c.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.52, R = Math.min(W, H) * 0.14, rings = [R * 1.75, R * 2.3, R * 2.85];
    // orbits
    c.setLineDash([2, 7]); rings.forEach((r, i) => { c.strokeStyle = `rgba(156,208,255,${0.22 - i * 0.04})`; c.beginPath(); c.ellipse(cx, cy, r, r * 0.42, -0.18, 0, Math.PI * 2); c.stroke(); }); c.setLineDash([]);
    // payout pulse
    if (S.pulse >= 0) { S.pulse += 0.02; const r = R + S.pulse * rings[2]; c.strokeStyle = `rgba(191,227,255,${Math.max(0, 0.7 * (1 - S.pulse))})`; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy, r, r * 0.42, -0.18, 0, Math.PI * 2); c.stroke(); c.lineWidth = 1; if (S.pulse > 1) S.pulse = -1; }
    // the far half of the orbit, then the planet, then the near half
    const pods = [];
    for (const w of S.wallets) { if (w.bot && !w.dying) continue; if (!w.tokens && w.dying > 1.2) continue;
      const m = mult((S.t - w.since) / 3600), r = rings[0] + (rings[2] - rings[0]) * ((m - 1) / 2) * (w.dying ? 1 - Math.min(1, w.dying - 1) : 1);
      w.a += 0.006 * (3.2 - m); pods.push({ x: Math.cos(w.a) * r, y: Math.sin(w.a) * r * 0.42, w, r }); }
    if (S.you.tokens > 0 || S.you.falling) { const m = S.you.tokens ? mult((S.t - S.you.since) / 3600) : 1; S.you.a = (S.you.a || 0) + 0.006 * (3.2 - m); const r = rings[0] + (rings[2] - rings[0]) * ((m - 1) / 2); pods.push({ x: Math.cos(S.you.a) * r, y: Math.sin(S.you.a) * r * 0.42, you: true }); }
    const rot = (p) => ({ x: cx + p.x * Math.cos(-0.18) - p.y * Math.sin(-0.18), y: cy + p.x * Math.sin(-0.18) + p.y * Math.cos(-0.18) });
    const drawPod = p => { const q = rot(p); if (p.you) { c.fillStyle = '#8ff0c8'; c.fillRect(q.x - 6, q.y - 6, 12, 12); c.font = '700 11px Pixelify, monospace'; c.fillText('you', q.x + 9, q.y - 6); return; }
      const w = p.w; if (w.dying) { w.dying += 0.02; c.fillStyle = `rgba(255,125,92,${Math.max(0, 1.6 - w.dying)})`; c.fillRect(q.x - 3, q.y - 3, 6, 6); return; }
      w.glow = Math.max(0, (w.glow || 0) - 0.02); c.fillStyle = w.sniper ? 'rgba(255,176,143,.85)' : `rgba(${211 + 44 * w.glow},${233 + 22 * w.glow},255,${0.75 + 0.25 * w.glow})`; c.fillRect(q.x - 3.5, q.y - 3.5, 7, 7); };
    pods.filter(p => p.y < 0).forEach(drawPod);
    const g = c.createRadialGradient(cx, cy, R * 0.8, cx, cy, R * 1.45); g.addColorStop(0, 'rgba(124,192,255,.35)'); g.addColorStop(1, 'rgba(124,192,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R * 1.45, 0, Math.PI * 2); c.fill();
    const u = Math.max(3, R / 7);
    for (let y = -R; y <= R; y += u) for (let x = -R; x <= R; x += u) { const d = Math.hypot(x + u / 2, y + u / 2); if (d > R) continue; const band = Math.floor((y + R) / (u * 3)) % 2; c.fillStyle = band ? '#9fd2ff' : '#e4f2ff'; if ((x * 7 + y * 3) % 5 === 0 && d < R * 0.8) c.fillStyle = '#5a97e8'; c.fillRect(cx + x, cy + y, u - 1, u - 1); }
    pods.filter(p => p.y >= 0).forEach(drawPod);
    // snipers burning up on the way in
    for (const b of S.bursts) { b.k += 0.018; const k = Math.min(1, b.k), dist = R * (4.2 - 3 * k), x = cx + Math.cos(b.a) * dist, y = cy + Math.sin(b.a) * dist * 0.6;
      if (k < 1) { c.fillStyle = '#ff7d5c'; c.fillRect(x - 4, y - 4, 8, 8); c.fillStyle = 'rgba(255,154,116,.35)'; c.fillRect(x - Math.cos(b.a) * 12 - 3, y - Math.sin(b.a) * 7 - 3, 6, 6); }
      else { const f = Math.min(1, (b.k - 1) * 2); for (let j = 0; j < 8; j++) { c.fillStyle = `rgba(255,${150 + j * 10},${110 + j * 8},${1 - f})`; c.fillRect(x + Math.cos(j * 0.8) * f * 22, y + Math.sin(j * 1.3) * f * 14, 3, 3); } } }
    S.bursts = S.bursts.filter(b => b.k < 1.5);
  }
  const fmt = v => (v >= 100 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v.toFixed(3));
  function ui() {
    $('[data-k=t]').textContent = `${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, '0')}`;
    $('[data-k=f]').textContent = `${(feeAt(S.t) * 100).toFixed(feeAt(S.t) < 0.1 ? 1 : 0)}%`;
    $('[data-k=bounty]').textContent = `${fmt(S.bounty)} SOL`; $('[data-k=paid]').textContent = `${fmt(S.paid)} SOL`;
    $('[data-k=holders]').textContent = S.wallets.filter(w => !w.bot && w.tokens > 0).length; $('[data-k=snipers]').textContent = S.burnt;
    const y = S.you, m = y.tokens ? mult((S.t - y.since) / 3600) : 0;
    $('[data-k=ytok]').textContent = y.tokens ? `${(y.tokens / SUPPLY * 100).toFixed(3)}%` : '—';
    $('[data-k=ym]').textContent = y.tokens ? (y.sniper ? 'out' : `${m.toFixed(2)}x`) : '—';
    $('[data-k=yfee]').textContent = y.feePaid ? `${fmt(y.feePaid)} SOL` : '—'; $('[data-k=ygot]').textContent = y.got ? `${y.got.toFixed(4)} SOL` : '—';
    $('[data-k=next]').textContent = clock(Math.max(0, S.nextPay - S.t));
    $('.sim-sell').disabled = !y.tokens; $('.sim-buy').disabled = S.done || !running;
  }
  function drawLog() { $('.sim-log').innerHTML = S.log.map(l => `<div class="${l.cls}"><span>${clock(l.t)}</span>${l.s}</div>`).join(''); }
  function finish() {
    const y = S.you; ui();
    say(`one hour in: ${fmt(S.bounty)} SOL paid in fees, ${fmt(S.paid)} SOL of it already paid out to holders${y.got ? `, ${y.got.toFixed(4)} SOL to you` : ''}`, 'pay');
    $('.sim-go').innerHTML = 'Run it again <span class="ar">↻</span>';
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (running && !document.hidden) step(dt * speed * (S.t < 120 ? 10 : 80));
    draw(); ui();
  }
  // controls
  $('.sim-go').addEventListener('click', () => { S = fresh(); running = true; $('.sim-go').innerHTML = 'Restart <span class="ar">↻</span>'; say('test coin launched: fee 99%, falling to 1% over two minutes', 'pay'); root.classList.add('live'); });
  root.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => { speed = +b.dataset.s; root.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b)); }));
  $('.sim-buy').addEventListener('click', () => {
    if (!running) return; const r = buy(null, 1);
    if (!S.you.tokens) { S.you.since = S.t; S.you.sniper = S.t <= 120; }
    S.you.tokens += r.tokens; S.you.feePaid += r.feePaid; S.you.spent += 1;
    say(S.you.sniper ? `you bought 1 SOL at a ${(r.fee * 100).toFixed(0)}% fee. Bought in the first two minutes: no payouts for you` : `you bought 1 SOL at a ${(r.fee * 100).toFixed(1)}% fee and entered orbit at 1x`, S.you.sniper ? 'hot' : 'you');
  });
  $('.sim-sell').addEventListener('click', () => { if (!S.you.tokens) return; const got = sell(S.you.tokens); S.you.tokens = 0; S.you.sniper = false; say(`you sold for ${got.toFixed(3)} SOL and fell out of orbit. Buy again to start back at 1x`, 'dim'); });
  S = fresh(); draw(); ui();
  new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }), { rootMargin: '100px' }).observe(root);
}
