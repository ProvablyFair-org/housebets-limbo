// LIMBO-21 Pass 2 — its false-alarm rates on honest data, DECLARED here and re-checkable with `npm run false-alarm:pass2`.
// Pass 2 rejects when the early-window statistic of the SCORED played targets (≤ 100×, src/sim-config.ts) of every revealed
// seed (the five bet files, src/simulate.ts PASS2_SETS) has a one-sided normal lower-tail p below 0.01. Two forms are
// replayed on the SAME replicates: the pooled standardised return (Σ return − Σ mean)/√Σ var, scored until 14 Oct 2026, and
// the per-slot standardised return scored since, Σ (win − p)/√(p(1 − p)) ÷ √slots (the roulette/keno form; for a limbo slot
// the target cancels). Both are sums of skewed
// terms, so their true lower tail at the normal 1 % point can differ from 1 %. No closed form exists; this is a plain Monte
// Carlo over the scored played slots (fixed seed, xoshiro128** generator, one uniform per slot per replicate, win probability
// = winning draws / 2^32), and each rate is the share of replicates its rule rejects. The same replicates give the fair-play
// distribution of the "epochs below expectation" count verify prints (epochs whose early-window scored return is below its
// exact mean): its mean and sd over the replicates.
import { hund } from './rules.ts';
import { winningDraws } from './rng.ts';
import { normalLowerTailP } from './stats.ts';
import { SIM_PASS2_ALPHA, SIM_PASS2_MAX_TARGET_H } from './sim-config.ts';
import { loadPass2Sets } from './simulate.ts';

export const PASS2_FALSE_ALARM = Object.freeze({
  rate: 0.005,
  standardError: 0.000158,
  perSlotRate: 0.00946,
  perSlotStandardError: 0.000216,
  belowMean: 99.2,
  belowSd: 5.47,
  replicates: 200_000,
  seed: 20261013,
  method: 'plain Monte Carlo over the scored played slots (target <= 100x) of every revealed seed of the five bet files (win ~ Bernoulli(winning draws / 2^32), return = target on a win), both rules applied to each replicate',
});

function xoshiro(seed: number) {
  let a = seed >>> 0, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  return (): number => {
    const r = (Math.imul(Math.imul(b, 5) << 7 | Math.imul(b, 5) >>> 25, 9)) >>> 0;
    const t = b << 9; c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return r / 4294967296;
  };
}

export function simulatePass2FalseAlarm(replicates: number, seed: number) {
  // the scored slots (src/sim-config.ts) of every revealed seed, in the census's order: file by file, dataset order
  const scored = loadPass2Sets().flatMap(({ set, ds }) => ds.bets.filter((b) => hund(b.setting.target) <= SIM_PASS2_MAX_TARGET_H).map((b) => ({ b, key: `${set}/${b.epoch}` })));
  const p = Float64Array.from(scored, ({ b }) => winningDraws(hund(b.setting.target)).count / 4294967296);
  const m = Float64Array.from(scored, ({ b }) => hund(b.setting.target) / 100);
  const sdp = Float64Array.from(p, (x) => Math.sqrt(x * (1 - x)));
  const epochs = [...new Set(scored.map((x) => x.key))]; const eIdx = new Map(epochs.map((e, i) => [e, i]));
  const ep = Int32Array.from(scored, (x) => eIdx.get(x.key)!);
  let mean = 0, v = 0; for (let i = 0; i < p.length; i++) { mean += m[i] * p[i]; v += m[i] * m[i] * p[i] * (1 - p[i]); }
  const eMean = new Float64Array(epochs.length); for (let i = 0; i < p.length; i++) eMean[ep[i]] += m[i] * p[i];
  const sd = Math.sqrt(v), root = Math.sqrt(p.length), rnd = xoshiro(seed);
  let rej = 0, rejSlot = 0, bSum = 0, bSum2 = 0; const per = new Float64Array(epochs.length);
  for (let r = 0; r < replicates; r++) {
    let s = 0, zs = 0; per.fill(0);
    for (let i = 0; i < p.length; i++) { const w = rnd() < p[i]; if (w) { s += m[i]; per[ep[i]] += m[i]; } zs += ((w ? 1 : 0) - p[i]) / sdp[i]; }
    if (normalLowerTailP((s - mean) / sd) < SIM_PASS2_ALPHA) rej++;
    if (normalLowerTailP(zs / root) < SIM_PASS2_ALPHA) rejSlot++;
    let below = 0; for (let e = 0; e < per.length; e++) if (per[e] < eMean[e]) below++;
    bSum += below; bSum2 += below * below;
  }
  const rate = rej / replicates, slotRate = rejSlot / replicates;
  const bMean = bSum / replicates, bSd = Math.sqrt(Math.max(0, bSum2 / replicates - bMean * bMean));
  return { rate: Number(rate.toFixed(5)), standardError: Number(Math.sqrt(rate * (1 - rate) / replicates).toPrecision(3)),
    perSlotRate: Number(slotRate.toFixed(5)), perSlotStandardError: Number(Math.sqrt(slotRate * (1 - slotRate) / replicates).toPrecision(3)),
    belowMean: Number(bMean.toFixed(2)), belowSd: Number(bSd.toFixed(2)), replicates, seed, slots: p.length, epochs: epochs.length };
}

if (process.argv[1] && /false-alarm-pass2\.ts$/.test(process.argv[1])) {
  const r = simulatePass2FalseAlarm(PASS2_FALSE_ALARM.replicates, PASS2_FALSE_ALARM.seed);
  const same = r.rate === PASS2_FALSE_ALARM.rate && r.standardError === PASS2_FALSE_ALARM.standardError && r.perSlotRate === PASS2_FALSE_ALARM.perSlotRate
    && r.perSlotStandardError === PASS2_FALSE_ALARM.perSlotStandardError && r.belowMean === PASS2_FALSE_ALARM.belowMean && r.belowSd === PASS2_FALSE_ALARM.belowSd;
  console.log(JSON.stringify(r), same ? '== the declaration' : '!= the declaration: update PASS2_FALSE_ALARM');
  process.exitCode = same ? 0 : 1;
}
