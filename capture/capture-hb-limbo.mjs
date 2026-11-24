#!/usr/bin/env node
// REFERENCE COPY, not a runnable tool: the limbo capture rig of the ProvablyFair.org audit of HouseBets,
// with comments edited (names, internal paths) and the code unchanged. Reference copy; the as-run file
// (sha256 e731d083dd46ae5e5c8a5377d957caf68aa07b6f016aa37eca973b476b8e0874,
// recorded in data/supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json meta) is held privately.
// The rig files Phase A ran (sha256 a5b1849460c5b6f2378740ac1f4cd5d58ff868b20f07c2a1e0789ccf23717fd0) and Phases C and D ran
// (sha256 4406f42d6637813caceca2424c6ab32232868bf3be64f9f09df7eb8d6e659fe7) were not kept.
/* ============================================================================
 *  HouseBets House Games (new engine) — LIMBO capture  ·  ProvablyFair.org
 *  Written 2026-10-10.
 *  Endpoints and fields: quoted from the limbo game page bundle of 10 Oct 2026 (sha256 7b12dc43…2b00).
 *
 *   POST /housegames/limbo/bet {betNumber, amount, currency, generation}
 *
 *  PLAN (500 rounds at the minimum stake): 14 fixed targets × 10 = 140
 *   (1.01 = the bundle's minimum, 1.02, 1.1, 1.5, 2, 3, 5, 10, 50, 100, 1000, 10000, 100000, 1000000 = the maximum)
 *   + 360 CSPRNG targets, log-uniform on [1.01, 1000000], 2 dp.
 *  SETUP / OPTIONS: as capture-hb-dice.mjs (refresh.curl, --probe, --resume, --base-stake, --currency, --epoch, --origin, --per-class)
 *  PHASES (12 Oct, hb-sp-core; no --phase = Phase A, unchanged): --phase=C 250 bets at target 1.98 (win chance ≈ 50 %)
 *   at 100 × the minimum · --phase=D --client-seeds=s1,s2,s3,s4 [--empty-seed-control] 4 × 50 at the minimum
 * ==========================================================================*/
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { runCapture, rint, shuffle } from '../common/hb-sp-core.mjs';

const FIXED = [1.01, 1.02, 1.1, 1.5, 2, 3, 5, 10, 50, 100, 1000, 10000, 100000, 1000000];
const randTarget = () => {   // log-uniform on [1.01, 1e6]; U from crypto.randomInt
  const U = rint(0, 2 ** 31) / 2 ** 31;
  return Math.min(1e6, Math.max(1.01, Math.round(1.01 * Math.exp(U * Math.log(1e6 / 1.01)) * 100) / 100));
};
const adapter = {
  game: 'limbo', gameType: 'limbo', betPath: '/limbo/bet', limitsSlug: 'limbo', fairnessSlug: 'limbo', seedPrefix: 'pflimbo', extraGets: [],
  scriptFile: fileURLToPath(import.meta.url),
  planDoc: '500 = 14 fixed targets (1.01 … 1,000,000) × 10 + 360 CSPRNG log-uniform targets; one bet per round at the base stake',
  buildPlan() {
    const plan = [];
    for (const t of FIXED) for (let i = 0; i < 10; i++) plan.push({ cls: `fixed-${t}`, target: t });
    for (let i = 0; i < 360; i++) plan.push({ cls: 'random', target: randTarget() });
    return shuffle(plan);
  },
  probePlan: () => [{ cls: 'fixed-1.01', target: 1.01 }, { cls: 'fixed-2', target: 2 }, { cls: 'random', target: randTarget() }],
  // supplementary phases (used only with --phase)
  phases: {
    C: { count: 250, setting: { target: 1.98 }, entry: () => ({ cls: 'C-target-1.98', target: 1.98 }),
      doc: 'Phase C: 250 bets = 5 epochs × 50 at target 1.98 (win chance 0.99/1.98 ≈ 50 %, pays 1.98×), stake 100 × the minimum',
      variants: { safe: { count: 200, setting: { target: 1.1 }, entry: () => ({ cls: 'C-target-1.10', target: 1.1 }),
        doc: 'Phase C (safe, 13 Oct $10 set): 200 bets = 4 epochs × 50 at target 1.10 (win chance 0.99/1.10 = 90 %, pays 1.1×), stake --stake' } } },
    D: { doc: 'Phase D: one epoch of 50 bets per player-set client seed (--client-seeds, in order) at the minimum stake; targets drawn from a fresh Phase A plan (CSPRNG)' },
  },
  stakeOf: (_e, base) => base,
  body: (e, base, currency) => ({ betNumber: e.target, amount: base, currency, generation: randomUUID() }),
  // the bundle's answer check vp(): game.{outcome>=1, betNumber>=1.01, fairnessVersion}, game.game.{nonce>=1, payoutMultiplier,
  // amount, roundId, clientSeed, hashedSeed}, round.{payout, stake, roundId == game.game.roundId}, balance
  extract(o, e) {
    const d = (o && o.game) || {}, u = d.game || {}, r = (o && o.round) || {};
    return {
      outcome: d.outcome ?? null, echoedTarget: d.betNumber ?? null, nonce: u.nonce ?? null, respClientSeed: u.clientSeed ?? null, respHashedSeed: u.hashedSeed ?? null,
      payoutMultiplier: u.payoutMultiplier ?? null, payout: r.payout ?? null, roundStake: r.stake ?? null, roundId: u.roundId ?? null, roundIdRound: r.roundId ?? null,
      fairnessVersion: d.fairnessVersion ?? null, balance: o ? o.balance ?? null : null,
      sameSetting: d.betNumber != null ? Math.round(d.betNumber * 100) === Math.round(e.target * 100) : null,
    };
  },
};
runCapture(adapter, dirname(fileURLToPath(import.meta.url))).catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
