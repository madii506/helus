// Small helpers shared by every page.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = (a, n = 4) => (a && a.length > n * 2 + 1 ? `${a.slice(0, n)}…${a.slice(-n)}` : a || '');
export const isAddr = s => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(s || '').trim());
export const pct = (v, d = 2) => (v == null || !isFinite(v) ? '—' : `${Number(v).toFixed(v >= 10 ? 1 : d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')}%`);
export const solscan = (kind, id) => `https://solscan.io/${kind}/${id}`;
export function ago(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
}
export function dur(sec) {
  if (sec < 60) return `${sec}s`; if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
  return `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}m`;
}
// public names are typed by strangers: mask the worst words before they reach the page
const BAD = /n[i1!]gg|f[a@]gg?[o0]t|k[i1]ke|r[e3]t[a@]rd|tr[a@]nn|ch[i1]nk|sp[i1]c\b|c[o0]{2}n\b|h[i1]tl[e3]r|rap(e|ist)\b|p[e3]d[o0]/i;
export const safe = s => { const t = String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32); return BAD.test(t) ? '•••' : t; };

let toastT;
export function toast(msg) {
  let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
}
export async function copy(text, label = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(label); } catch { toast('Copy failed: select and copy by hand'); }
}
export async function pasteInto(input) {
  try { const t = (await navigator.clipboard.readText()).trim(); if (t) { input.value = t; input.dispatchEvent(new Event('input')); input.focus(); } } catch { input.focus(); toast('Paste with Ctrl/⌘ + V'); }
}

// a 5x5 mirrored pixel mark per address, in the Astro palette
const PAL = ['#9cd0ff', '#d3e9ff', '#4c9dff', '#8ff0c8', '#bfe3ff'];
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function identicon(addr, size = 34) {
  const c = document.createElement('canvas'); c.width = c.height = 7; const x = c.getContext('2d');
  let h = hash(addr || 'helus'); const fg = PAL[h % PAL.length]; h = hash(addr + '!');
  x.fillStyle = '#0f1729'; x.fillRect(0, 0, 7, 7); x.fillStyle = fg;
  for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) { if ((h >> (r * 3 + q)) & 1) { x.fillRect(1 + q, 1 + r, 1, 1); x.fillRect(5 - q, 1 + r, 1, 1); } }
  c.style.width = c.style.height = size + 'px'; c.setAttribute('aria-hidden', 'true'); return c;
}
// count a number up in pixel type
export function countTo(el, to, ms = 900) {
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (from === to) { el.textContent = to.toLocaleString('en-US'); return; }
  if (to > from) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
  const t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
// letters shuffle through pixel glyphs and settle, left to right
const GLYPH = '▖▘▝▗▚▞█▓▒░#%&@$';
export function scramble(el, ms = 700) {
  const text = el.dataset.text || el.textContent; el.dataset.text = text; const t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), n = Math.floor(text.length * k);
    el.textContent = text.slice(0, n) + [...text.slice(n)].map(ch => (ch === ' ' ? ' ' : GLYPH[(Math.random() * GLYPH.length) | 0])).join('');
    if (k < 1) requestAnimationFrame(step); else el.textContent = text;
  };
  requestAnimationFrame(step);
}
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
let cfgP = null;
export function config() { return (cfgP ||= fetch('/api/config').then(r => r.json()).catch(() => ({ ok: false }))); }
