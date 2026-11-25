// Replay any Solana launch as if it ran on helus: reads its first two minutes from the chain (via /api/replay)
// and shows what those buys would have paid under the fee curve, and which wallets would be left out of payouts.
import { esc, short, ago, identicon, copy, toast, solscan, isAddr } from './util.js';
import { feeAt, fmtSol } from './model.js?v=1';

const STEPS = ['Finding the block where trading opened', 'Reading the first two minutes, buy by buy', 'Tracing who funded the early wallets', 'Putting every buy through the fee curve'];
const pctTxt = f => `${(f * 100).toFixed(f < 0.1 ? 1 : 0)}%`;
export const replayLink = mint => `${location.origin}/?replay=${mint}#replay`;

export function replayEmpty(res) {
  res.innerHTML = `<div class="rp-empty">
    <div><b>The launch block</b><span>Who bought in the very first block, at a 99% fee.</span></div>
    <div><b>Two minutes, second by second</b><span>Every buy, what it spent, and the fee helus would have charged at that moment.</span></div>
    <div><b>Shared funders</b><span>Wallets fed by the dev or by one hand, left out of payouts.</span></div>
    <div><b>The bounty</b><span>What those buys would have paid in, and the holders' share of it.</span></div></div>`;
}

let current = null;
export async function runReplay(mint, res, { scroll = true } = {}) {
  mint = String(mint || '').trim();
  if (!isAddr(mint)) { res.innerHTML = `<div class="rp-err">That doesn't look like a Solana contract address. It should be 32 to 44 letters and numbers.</div>`; return; }
  if (current) current.abort();
  const ctl = new AbortController(); current = ctl;
  res.innerHTML = `<div class="rp-load"><ol>${STEPS.map(s => `<li><i></i>${s}</li>`).join('')}</ol></div>`;
  if (scroll) res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const lis = [...res.querySelectorAll('li')]; let k = 0;
  const tick = () => lis.forEach((li, i) => (li.className = i < k ? 'ok' : i === k ? 'on' : '')); tick();
  const timer = setInterval(() => { if (k < lis.length - 1) { k++; tick(); } }, 2200);
  let r;
  try {
    const t = setTimeout(() => ctl.abort(), 65000);
    const resp = await fetch(`/api/replay?mint=${encodeURIComponent(mint)}`, { signal: ctl.signal });
    clearTimeout(t); r = await resp.json();
  } catch (e) {
    clearInterval(timer); if (ctl !== current) return;
    res.innerHTML = `<div class="rp-err">${e.name === 'AbortError' ? 'Solana took too long to answer. Busy coins can be slow on the free connection: try again in a moment.' : 'Could not reach helus. Check your connection and try again.'}</div>`; return;
  }
  clearInterval(timer); if (ctl !== current) return;
  if (!r || !r.ok) { res.innerHTML = `<div class="rp-err">${esc((r && r.error) || 'The replay failed. Try again in a moment.')}</div>`; return; }
  lis.forEach(li => (li.className = 'ok')); await new Promise(z => setTimeout(z, 240));
  render(r, res);
}

function render(r, res) {
  const h = r.helus, name = esc(r.name || 'Unnamed coin'), sym = esc(r.symbol || '???');
  const why = b => (b.dev ? ['dev', 'the creator'] : b.also ? ['out', b.also] : ['out', 'sniper']);
  const rows = h.list.map(b => { const [cls, label] = why(b); return `<tr><td><a href="${solscan('account', b.owner)}" target="_blank" rel="noopener">${short(b.owner, 4)}</a></td><td>${b.slot === 0 ? 'block 0' : `${b.t}s`}</td><td class="r">${b.sol.toFixed(2)}</td><td class="r">${pctTxt(b.fee)}</td><td class="r">${b.paid.toFixed(2)}</td><td><span class="chip ${cls}">${esc(label)}</span></td></tr>`; }).join('');
  const partial = r.read && r.read.partial;
  res.innerHTML = `<div class="rp-card">
    <div class="rp-top"><div class="rp-img"></div>
      <div style="min-width:0"><div class="rp-name">${name}<small>$${sym}</small></div>
        <div class="rp-sub"><a href="${solscan('token', r.mint)}" target="_blank" rel="noopener">${short(r.mint, 5)} ↗</a><span>${esc(r.venue || 'Solana')}</span><span>launched ${r.launch.time ? ago(Date.now() - r.launch.time * 1000) + ' ago' : 'at an unknown time'}</span></div></div>
      <div class="rp-acts"><button class="btn g sm" type="button" data-a="link">Copy link</button><a class="btn g sm" data-a="x" target="_blank" rel="noopener">Share on X</a></div></div>
    <div class="rp-hero">
      <div class="main"><span>into the bounty on helus</span><b>${fmtSol(h.bounty)}</b><p>${h.buys ? `If the same ${h.buys} buys from ${h.wallets} wallet${h.wallets === 1 ? '' : 's'} had landed on helus in the first two minutes, this is what the fee curve would have kept.` : 'Nobody bought in the first two minutes, so there was nothing for the curve to catch.'}</p></div>
      <div><span>to holders</span><b>${fmtSol(h.split.holders)}</b></div>
      <div><span>spent in two minutes</span><b>${fmtSol(h.spent)}</b></div>
      <div><span>from block 0 alone</span><b>${fmtSol(h.block0)}</b></div>
    </div>
    <div class="rp-body">
      <div><p class="rp-h"><span>Every early buy against the curve</span><span>size = SOL spent</span></p><canvas class="rp-tl"></canvas></div>
      <div><p class="rp-h"><span>Left out of payouts</span><span>${h.wallets} wallet${h.wallets === 1 ? '' : 's'}${h.bundled ? ` · ${h.bundled} shared funders` : ''}</span></p>
        ${h.list.length ? `<div class="rp-table"><table><thead><tr><th>Wallet</th><th>When</th><th class="r">SOL</th><th class="r">Fee</th><th class="r">Paid</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p style="margin:0;font-size:14.5px">No early buyers to leave out.</p>'}</div>
    </div>
    <div class="rp-foot">Read ${r.read.read} of ${r.read.early} transactions from the first two minutes in ${(r.read.ms / 1000).toFixed(1)}s, straight from Solana${partial ? ' · some went unread, so these numbers are a minimum' : ''}. SOL spent includes network fees. A what-if, not financial advice.</div>
  </div>`;
  const img = res.querySelector('.rp-img');
  if (r.image) { const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.onload = () => { img.textContent = ''; img.append(im); }; im.src = r.image; }
  img.append(identicon(r.mint, 52));
  res.querySelector('[data-a="link"]').onclick = () => copy(replayLink(r.mint), 'Link copied');
  res.querySelector('[data-a="x"]').href = `https://x.com/intent/tweet?text=${encodeURIComponent(`If $${r.symbol || 'this coin'} had launched on helus, its first two minutes would have paid ${fmtSol(h.bounty)} into the bounty, ${fmtSol(h.split.holders)} of it for holders.\n\n${replayLink(r.mint)}`)}`;
  drawTimeline(res.querySelector('.rp-tl'), h);
}

function drawTimeline(cv, h) {
  const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d;
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); const w = r.width, H = r.height;
  const x = t => 14 + (t / 120) * (w - 28), y = f => 12 + (1 - f) * (H - 34);
  c.fillStyle = 'rgba(156,208,255,.07)'; [0, 30, 60, 90, 120].forEach(t => c.fillRect(x(t), 8, 1, H - 26));
  c.font = '500 10px Mono, monospace'; c.fillStyle = '#7f90ab'; [0, 30, 60, 90, 120].forEach(t => c.fillText(t ? `${t}s` : '0', x(t) - 4, H - 6));
  c.strokeStyle = 'rgba(156,208,255,.55)'; c.lineWidth = 2; c.beginPath(); for (let t = 0; t <= 120; t++) { const X = x(t), Y = y(feeAt(t)); t ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke();
  const max = Math.max(0.01, ...h.list.map(b => b.sol));
  for (const b of h.list.slice().sort((a, z) => z.sol - a.sol)) {
    const s = 4 + Math.sqrt(b.sol / max) * 16, X = x(Math.min(120, b.t)), Y = y(b.fee);
    c.fillStyle = b.fee > 0.5 ? '#ff7d5c' : b.fee > 0.15 ? '#ffb08f' : '#9cd0ff'; c.globalAlpha = 0.85;
    c.fillRect(Math.round(X - s / 2), Math.round(Y - s / 2), Math.round(s), Math.round(s)); c.globalAlpha = 1;
  }
}

export function mountReplay({ form, input, res, paste }) {
  replayEmpty(res);
  form.addEventListener('submit', e => { e.preventDefault(); runReplay(input.value, res); });
  if (paste) paste.onclick = async () => { try { const t = (await navigator.clipboard.readText()).trim(); if (t) { input.value = t; runReplay(t, res); } } catch { input.focus(); toast('Paste with Ctrl/⌘ + V'); } };
  const q = new URLSearchParams(location.search).get('replay');
  if (q) { input.value = q; setTimeout(() => runReplay(q, res), 600); }
  return { run: m => { input.value = m; return runReplay(m, res); } };
}
