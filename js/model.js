// The helus numbers in one place, shared by the home page, the app and the docs.
export const feeAt = t => (t >= 120 ? 0.01 : 0.99 * Math.pow(1 / 99, Math.max(0, t) / 120));   // 99% at launch, 1% at two minutes
export const mult = h => 1 + Math.min(24, Math.max(0, h)) / 12;                                // 1x, 2x at 12 h, 3x from 24 h
export const SPLIT = { holders: 0.4, creator: 0.24, helus: 0.16, meteora: 0.2 };
export const PAYOUTS_PER_DAY = 144, WALLET_CAP = 0.02;
// an estimate from the visitor's own inputs: 1% fee, holders' 40%, 60% of supply eligible at an average 2x, the 2% cap
export function payoutEstimate({ volume, bagPct, hours, fee = 0.01, eligible = 60, avgMult = 2 }) {
  const pool = volume * fee * SPLIT.holders;
  const share = Math.min(WALLET_CAP, (bagPct * mult(hours)) / (eligible * avgMult));
  const perDay = pool * share;
  return { perDay, perPayout: perDay / PAYOUTS_PER_DAY, perMonth: perDay * 30, share };
}
export const fmtSol = v => (!isFinite(v) ? '—' : v >= 100 ? `${Math.round(v).toLocaleString('en-US')} SOL` : v >= 1 ? `${v.toFixed(2)} SOL` : v >= 0.01 ? `${v.toFixed(3)} SOL` : `${v.toFixed(5)} SOL`);
