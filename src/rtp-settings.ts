// RTP-CLAIM wiring — HouseBets limbo: the exact RTP of every legal target and the claim it is held to.
// The rule is src/rtp-claim.ts, a byte-identical copy of the framework's core/rtp-claim.ts (conformance C-13 compares the
// SHA-256), version 1.2.0. The switch src/rtp-claim-switch.ts is ON (Methodology v1.1, 14 Oct 2026): the -19 check is
// scored; a house-side miss is OVERSTATED and, unless another check fails or a step is missing, the verdict is RTP FIGURE
// OVERSTATED (exit 5), not NOT PROVABLY FAIR. A committed table that no longer equals the run or its pin is a reproduction
// failure (exit 1), miss or no miss: the framework rule. The claim's source names every place our evidence states the figure, from the rule's six (game page,
// fairness page, help page, bet panel, rules, game settings), worded to what was read: the rules panel text in the
// game's page code (E02; the rendered panel was not captured) and the fairness answer (E01), the game settings the site loads.
//
// SETTINGS. Every legal target, 1.01× … 1,000,000.00× in steps of 0.01× (E02 bc = 1.01, eo = 1e6, 2-decimal targets):
// 99,999,900 settings. EXACT RTP. A target T (hundredths) wins on exactly w(T) of the 2^32 draws (src/rng.ts winningDraws:
// the declared formula's winning draws, counted exactly at the monotone boundary) and pays T/100, so RTP = w(T)·T / (100·2^32).
// Integer arithmetic (w·T < 2^53). The multiplier is the payout rule's own (src/rules.ts multiplierH: the target), so a payout
// rule that paid less at some target would lower that target's RTP here. CLAIM: read at verify time from
// the pinned exhibits by src/exhibits.ts, never from a src/ constant: a flat figure, the highest one stated across the places
// our evidence shows it (the rules, E02 rulesRtpLine "RTP is 99% at every target; the house edge is 1%." and, reworded on
// 16 Oct, E07 rulesRtpLine "Theoretical RTP before payout rounding: 99% (1% house edge)."; the game settings,
// E01 houseEdge 0.01 and "A target t is reached with probability 0.99 / t").
// Not scored here: the truncation of each payout to the wallet's 1e-8 unit, which depends on the stake (MANIFEST.md#payouts-and-rtp).
//   npm run rtp-claim:write    rewrite outputs/rtp-claim-table.json and print its SHA-256 to pin
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RtpClaimAccumulator, rtpClaimTable, rtpClaimGate } from './rtp-claim';
import type { RtpClaim, RtpClaimResult, RtpClaimGate } from './rtp-claim';
import { winningDraws } from './rng.ts';
import { multiplierH } from './rules.ts';
import { MIN_TARGET_H, MAX_TARGET_H, TWO32 } from './spec.ts';
import { ROOT } from './loader.ts';
import { readExhibits, type Exhibits } from './exhibits.ts';

/** The claim LIMBO-19 holds the game to, from the exhibits. With no figure readable at any place the claim is recorded as
 *  noted (never a miss) and LIMBO-19 cannot pass (its own condition: the claim read from the exhibits). */
export function rtpClaimFromExhibits(ex: Exhibits = readExhibits()): RtpClaim {
  if (ex.claimRtp === null) return { kind: 'noted', source: ex.claimSource, text: 'no RTP figure could be read from the exhibits in the form they were read in' };
  return { kind: 'flat', rtp: ex.claimRtp, source: ex.claimSource };
}
export const RTP_CLAIM_TABLE = join(ROOT, 'outputs', 'rtp-claim-table.json');
/** SHA-256 of the committed table — re-pin with the run that rewrote it (npm run rtp-claim:write). */
export const RTP_CLAIM_TABLE_SHA256 = 'd54a967de057c67126edb7adfe7bef72cd94e273df9e44373a4f8ad33a294d93';
const DEN = 100 * TWO32;

/** The grid walk, shared with LIMBO-08 / LIMBO-19: per target the declared and exact winning-draw counts. */
export interface GridScan { targets: number; nonMonotone: number; floatBelowExact: number[]; floatAboveExact: number; maxDevOver2_32: number; atBound: number; atBoundNonDivisor: number }

export function computeRtpClaim(claim: RtpClaim, scan?: GridScan): RtpClaimResult {
  const acc = new RtpClaimAccumulator(claim, { retainRows: 100 });
  for (let T = MIN_TARGET_H; T <= MAX_TARGET_H; T++) {
    const w = winningDraws(T);
    if (scan) {
      scan.targets++; if (!w.ok) scan.nonMonotone++;
      if (w.count < w.exact) scan.floatBelowExact.push(T); else if (w.count > w.exact) scan.floatAboveExact++;
      // |w/2^32 − 0.99·100/T| in units of 2^-32: |w·T − 99·2^32| / T
      const gap = Math.abs(w.count * T - 425201762304), dev = gap / T; if (dev > scan.maxDevOver2_32) scan.maxDevOver2_32 = dev;
      // a deviation of exactly 2^-32 is possible only where 99·2^32 / T is a whole draw (that draw itself wins): counted
      if (gap === T) { scan.atBound++; if (425201762304 % T !== 0) scan.atBoundNonDivisor++; }
    }
    const decade = T < 1_000 ? '1×–10×' : T < 10_000 ? '10×–100×' : T < 100_000 ? '100×–1000×' : T < 1_000_000 ? '1000×–10000×' : T < 10_000_000 ? '10000×–100000×' : T < 100_000_000 ? '100000×–1000000×' : '1,000,000×';
    acc.add(() => `target ${(T / 100).toFixed(2)}`, w.count * multiplierH(T), DEN, decade);
  }
  return acc.result();
}

export function rtpClaimTableText(r: RtpClaimResult): string {
  return rtpClaimTable(r, {
    package: 'housebets/limbo', game: 'limbo',
    settingSpace: 'every legal target 1.01×–1,000,000.00× in 0.01× steps (99,999,900 settings); rows retained: the extremes and any house-side setting',
    rtpMethod: 'exact rational: winning draws w(T) of the 2^32 under the declared formula (src/rng.ts winningDraws) × T/100, over 2^32',
  });
}

export function runRtpClaimGate(r: RtpClaimResult = computeRtpClaim(rtpClaimFromExhibits())): RtpClaimGate {
  return rtpClaimGate(r, rtpClaimTableText(r), RTP_CLAIM_TABLE, RTP_CLAIM_TABLE_SHA256);
}

if (process.argv[1] && /rtp-settings\.ts$/.test(process.argv[1])) {
  const text = rtpClaimTableText(computeRtpClaim(rtpClaimFromExhibits()));
  writeFileSync(RTP_CLAIM_TABLE, text);
  console.log(`wrote outputs/rtp-claim-table.json sha256 ${createHash('sha256').update(text).digest('hex')}`);
}
