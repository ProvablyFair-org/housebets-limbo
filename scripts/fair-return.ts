// The observed return of the Phase A bets (and of the capture file E05 lists, Phase A + its tail) and the distribution of that
// return under the fair game, for the README's observed-return line. Each bet keeps its served target and stake, wins with its
// exact probability w(T) / 2^32 (src/rng.ts winningDraws) and pays floor(stake × T) at 1e-8 (src/rules.ts). Plain Monte Carlo
// with a fixed seed (xoshiro128**, one uniform per bet per replicate). It prints the median, the 10th and 90th percentiles and
// the share of fair replicates that return at most the observed figure. Information only: no check reads it.
//   npm run fair-return
import { load, PRIMARY_FILE, TAIL_FILE } from '../src/loader.ts';
import { winningDraws } from '../src/rng.ts';
import { hund, u8, payout8, multiplier8 } from '../src/rules.ts';
import type { Bet } from '../src/types.ts';

const REPLICATES = 100_000, SEED = 20261027;
function xoshiro(seed: number) {
  let a = seed >>> 0, b = 0x9e3779b9, c = 0x243f6a88, d = 0xb7e15162;
  return (): number => {
    const r = (Math.imul(Math.imul(b, 5) << 7 | Math.imul(b, 5) >>> 25, 9)) >>> 0;
    const t = b << 9; c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = (d << 11) | (d >>> 21);
    return r / 4294967296;
  };
}
function run(label: string, bets: Bet[]) {
  let st = 0n, pd = 0n; const p: number[] = [], pay: number[] = [];
  for (const b of bets) {
    const s8 = u8(b.stake)!, th = hund(b.setting.target); st += s8; pd += u8(b.payout)!;
    p.push(winningDraws(th).count / 4294967296); pay.push(Number(payout8(s8, multiplier8(th))));
  }
  const obs = Number(pd) / Number(st), exp = p.reduce((a, x, i) => a + x * pay[i], 0) / Number(st);
  const rnd = xoshiro(SEED), R = new Float64Array(REPLICATES);
  for (let r = 0; r < REPLICATES; r++) { let s = 0; for (let i = 0; i < p.length; i++) if (rnd() < p[i]) s += pay[i]; R[r] = s / Number(st); }
  const sorted = Float64Array.from(R).sort(), q = (x: number) => sorted[Math.floor(x * (REPLICATES - 1))];
  console.log(JSON.stringify({ set: label, bets: bets.length, staked: Number(st) / 1e8, paid: Number(pd) / 1e8, observedReturnPct: +(obs * 100).toFixed(4),
    expectedReturnPct: +(exp * 100).toFixed(4), replicates: REPLICATES, seed: SEED, fairMedianPct: +(q(0.5) * 100).toFixed(2),
    fairP10Pct: +(q(0.1) * 100).toFixed(2), fairP90Pct: +(q(0.9) * 100).toFixed(2), shareAtOrBelowObserved: +(R.filter((x) => x <= obs).length / REPLICATES).toFixed(4) }));
}
const A = load(PRIMARY_FILE), T = load(TAIL_FILE);
run('Phase A', A.bets);
run('Phase A + tail (the capture file E05 lists)', [...A.bets, ...T.bets]);
