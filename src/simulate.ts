// HouseBets limbo — the simulation CENSUS (LIMBO-20 Pass 1, LIMBO-21 Pass 2). A pure function of src/sim-config.ts and the
// five shipped bet files (Pass 2 replays every revealed seed): counts and exact sums only (integers / BigInt), plus the lag-1
// and runs statistics of the 2,000,000-draw sequence (re-derived by the verifier, which re-runs this census in full).
//   npm run simulate        rewrite outputs/simulation-results.json (the pinned artifact) and print its sha256
//   npm run simulate:run    write outputs/run/simulation-results.json (a regeneration, compared by scripts/fresh-copy-check.mjs)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { drawU, resultFromU, winningDraws, sha256Hex } from './rng.ts';
import { wins, hund, multiplier8 } from './rules.ts';
import { ROOT, load, PRIMARY_FILE, TAIL_FILE, PHASE_C_FILE, PHASE_C10_FILE, PHASE_D_FILE } from './loader.ts';
import { PASS1_SEEDS, PASS1_NONCES, SIM_UNIFORMITY_BINS, SIM_UNIFORMITY_SHIFT, SIM_LAG_SHIFT, pass1Seed, SIM_EDGE_TARGETS_H, SIM_EDGE_BETS,
  BAND_SEEDS, bandSeed, SIM_CONVERGENCE_MARKS, SIM_LONG_TARGET_H, SIM_LONG_SEEDS, SIM_LONG_BETS, SIM_LONG_MARKS, longSeed, SIM_TABLE_BETS, TABLE_SEEDS, SIM_TABLE_TARGETS_H, tableSeed, SIM_PASS2_NONCES, SIM_PASS2_EARLY, SIM_PASS2_MAX_TARGET_H, SIM_PASS2_STATISTIC, FRESH_SEED_RULE } from './sim-config.ts';
import type { Dataset } from './types.ts';

/** One Pass 2 window: every played slot, and the SCORED slots (target ≤ SIM_PASS2_MAX_TARGET_H).
 *  ret8 = Σ multiplier8 on wins; mean = Σ multiplier8 · w (units 1e-8 · 2^-32); var = Σ multiplier8² · w · (2^32 − w)
 *  (units 1e-16 · 2^-64), w = winning draws of the slot's target. slotBets[j] / slotWins[j]: the slots of the window that
 *  replay the epoch's j-th played target (in nonce order) and how many of them win — the per-slot standardised return is
 *  re-derived from these counts in verify. */
export interface Window { bets: number; ret8: string; mean: string; var: string; scoredBets: number; scoredRet8: string; scoredMean: string; scoredVar: string; slotBets: number[]; slotWins: number[] }

export interface Row { targetH: number; winningDraws: number; multiplier8: string; bets: number; wins: number; marks: { n: number; wins: number }[] }
export interface Census {
  design: Record<string, unknown>;
  pass1: { draws: number; bins: number[]; lag1: { n: number; sumXY: string; sumX: string; sumX2: string }; runs: { n: number; n1: number; runs: number; median: string } };
  bands: Row[];        // the nine 1,000,000-bet targets
  long: Row;           // the 20,000,000-bet run at 2.00×
  table: Row[];        // the eight 2,000,000-bet targets
  pass2: { epochs: { set: string; epoch: number; seedHash: string; depth: number; early: Window; ref: Window }[] };
}

const fresh = (label: string): string => sha256Hex(label);
const TWO32 = 4294967296n;

/** The five shipped bet files Pass 2 replays, in this order (every revealed seed of the package). */
export const PASS2_SETS: readonly (readonly [string, string])[] = [['A', PRIMARY_FILE], ['tail', TAIL_FILE], ['C', PHASE_C_FILE], ['C10', PHASE_C10_FILE], ['D', PHASE_D_FILE]];
export const loadPass2Sets = (): { set: string; ds: Dataset }[] => PASS2_SETS.map(([set, f]) => ({ set, ds: load(f) }));

export function census(sets: readonly { set: string; ds: Dataset }[], onProgress?: (s: string) => void): Census {
  // ── Pass 1: uniformity histogram (top 7 bits), lag-1 sums on u >>> 16 (exact BigInt), runs about u ≥ 2^31
  const bins = new Array(SIM_UNIFORMITY_BINS).fill(0);
  let sx = 0n, sx2 = 0n, sxy = 0n, prev = -1, n = 0, n1 = 0, runs = 0, lastAbove: boolean | null = null;
  for (let i = 0; i < PASS1_SEEDS; i++) {
    const { server, client } = pass1Seed(i); const S = fresh(server);
    for (let nonce = 1; nonce <= PASS1_NONCES; nonce++) {
      const u = drawU(S, client, nonce);
      bins[u >>> SIM_UNIFORMITY_SHIFT]++;
      const v = u >>> SIM_LAG_SHIFT, V = BigInt(v); sx += V; sx2 += V * V; if (prev >= 0) sxy += BigInt(prev) * V; prev = v; n++;
      const above = u >= 2147483648; if (above) n1++; if (above !== lastAbove) { runs++; lastAbove = above; }
    }
  }
  onProgress?.(`pass 1: ${n} draws`);

  // ── Target bands
  const bands: Census['bands'] = [];
  SIM_EDGE_TARGETS_H.forEach((T, bi) => {
    let w = 0, k = 0; const marks: { n: number; wins: number }[] = [];
    const per = SIM_EDGE_BETS / BAND_SEEDS;
    for (let j = 0; j < BAND_SEEDS; j++) {
      const { server, client } = bandSeed(bi, j); const S = fresh(server);
      for (let nonce = 1; nonce <= per; nonce++) {
        if (wins(T, resultFromU(drawU(S, client, nonce)))) w++;
        k++; if (SIM_CONVERGENCE_MARKS.includes(k)) marks.push({ n: k, wins: w });
      }
    }
    bands.push({ targetH: T, winningDraws: winningDraws(T).count, multiplier8: String(multiplier8(T)), bets: k, wins: w, marks });
    onProgress?.(`band ${bi} ${T / 100}×: ${w}/${k}`);
  });

  // ── One target played for `seeds` fresh seeds × 10,000 nonces, the running win count kept at the marks
  const play = (T: number, seeds: number, seedOf: (j: number) => { server: string; client: string }, at: readonly number[]): Row => {
    let w = 0, k = 0; const marks: { n: number; wins: number }[] = [];
    for (let j = 0; j < seeds; j++) {
      const { server, client } = seedOf(j); const S = fresh(server);
      for (let nonce = 1; nonce <= 10_000; nonce++) {
        if (wins(T, resultFromU(drawU(S, client, nonce)))) w++;
        k++; if (at.includes(k)) marks.push({ n: k, wins: w });
      }
    }
    return { targetH: T, winningDraws: winningDraws(T).count, multiplier8: String(multiplier8(T)), bets: k, wins: w, marks };
  };
  // ── The long run at 2.00×
  const long = play(SIM_LONG_TARGET_H, SIM_LONG_SEEDS, longSeed, SIM_LONG_MARKS);
  onProgress?.(`long run ${SIM_LONG_TARGET_H / 100}×: ${long.wins}/${long.bets}`);
  // ── The edge table
  const table = SIM_TABLE_TARGETS_H.map((T) => { const r = play(T, TABLE_SEEDS, (j) => tableSeed(T, j), SIM_CONVERGENCE_MARKS); onProgress?.(`table ${T / 100}×: ${r.wins}/${r.bets}`); return r; });

  // ── Pass 2: every revealed seed of the five bet files × nonces 1..10,000, the epoch's played targets cycled over the window
  const epochs: Census['pass2']['epochs'] = [];
  const wd = new Map<number, bigint>();
  const W = (T: number): bigint => { let x = wd.get(T); if (x === undefined) { x = BigInt(winningDraws(T).count); wd.set(T, x); } return x; };
  for (const { set, ds } of sets) for (const sd of ds.seeds) {
    const e = Number(sd.epoch);
    const played = ds.bets.filter((b) => b.epoch === e).sort((a, b) => a.nonce - b.nonce).map((b) => hund(b.setting.target));
    const depth = SIM_PASS2_EARLY(played.length);
    const z = () => ({ bets: 0, ret: 0n, mean: 0n, v: 0n, sb: 0, sr: 0n, sm: 0n, sv: 0n, jb: new Array(played.length).fill(0) as number[], jw: new Array(played.length).fill(0) as number[] });
    const acc = { early: z(), ref: z() };
    for (let nonce = 1; nonce <= SIM_PASS2_NONCES; nonce++) {
      const j = (nonce - 1) % played.length, T = played[j];
      const m = multiplier8(T), w = W(T);
      const win = wins(T, resultFromU(drawU(sd.revealedServerSeed, sd.clientSeed, nonce)));
      const a = nonce <= depth ? acc.early : acc.ref;
      const mu = m * w, va = m * m * w * (TWO32 - w);
      a.bets++; if (win) a.ret += m; a.mean += mu; a.v += va; a.jb[j]++; if (win) a.jw[j]++;
      if (T <= SIM_PASS2_MAX_TARGET_H) { a.sb++; if (win) a.sr += m; a.sm += mu; a.sv += va; }
    }
    const out = (a: ReturnType<typeof z>): Window => ({ bets: a.bets, ret8: String(a.ret), mean: String(a.mean), var: String(a.v),
      scoredBets: a.sb, scoredRet8: String(a.sr), scoredMean: String(a.sm), scoredVar: String(a.sv), slotBets: a.jb, slotWins: a.jw });
    epochs.push({ set, epoch: e, seedHash: sd.hashedServerSeed, depth, early: out(acc.early), ref: out(acc.ref) });
  }
  onProgress?.(`pass 2: ${epochs.length} epochs × ${SIM_PASS2_NONCES}`);

  return {
    design: { freshSeedRule: FRESH_SEED_RULE, pass1: { seeds: PASS1_SEEDS, nonces: PASS1_NONCES, bins: SIM_UNIFORMITY_BINS, binOf: 'u >>> 25', lagOf: 'u >>> 16', runsAbove: 'u >= 2^31' },
      bands: { bets: SIM_EDGE_BETS, seeds: BAND_SEEDS, targetsH: SIM_EDGE_TARGETS_H, marks: SIM_CONVERGENCE_MARKS },
      long: { bets: SIM_LONG_BETS, seeds: SIM_LONG_SEEDS, targetH: SIM_LONG_TARGET_H, marks: SIM_LONG_MARKS },
      table: { bets: SIM_TABLE_BETS, seeds: TABLE_SEEDS, targetsH: SIM_TABLE_TARGETS_H, marks: SIM_CONVERGENCE_MARKS },
      pass2: { nonces: SIM_PASS2_NONCES, earlyWindow: 'nonces 1..n, n = the epoch\'s captured depth', scoredMaxTargetH: SIM_PASS2_MAX_TARGET_H, datasets: PASS2_SETS.map(([set, f]) => `${set}: ${f}`),
        statistic: SIM_PASS2_STATISTIC,
        units: 'slotBets[j] / slotWins[j] = slots replaying the epoch\'s j-th played target and their wins; ret8 = sum of multipliers in 1e-8 units; mean = sum multiplier8 × w (divide by 2^32 for 1e-8 units); var = sum multiplier8² × w × (2^32 − w) (divide by 2^64 for 1e-16 units); w = winning draws of the target' } },
    pass1: { draws: n, bins, lag1: { n, sumXY: String(sxy), sumX: String(sx), sumX2: String(sx2) }, runs: { n, n1, runs, median: '2^31' } },
    bands,
    long,
    table,
    pass2: { epochs },
  };
}

export const censusText = (c: Census): string => JSON.stringify(c, null, 2) + '\n';

if (process.argv[1] && /simulate\.ts$/.test(process.argv[1])) {
  const t0 = Date.now();
  const c = census(loadPass2Sets(), (s) => console.log(`  ${s}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`));
  const text = censusText(c);
  const emit = process.env.PF_EMIT === '1';
  const dir = emit ? join(ROOT, 'outputs') : join(ROOT, 'outputs', 'run'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'simulation-results.json'), text);
  console.log(`wrote ${emit ? 'outputs' : 'outputs/run'}/simulation-results.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
