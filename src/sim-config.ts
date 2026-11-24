// HouseBets limbo — FROZEN SIMULATION DESIGN, single-sourced so the producer (src/simulate.ts) and the verifier
// (tests/verify.ts, LIMBO-20 / LIMBO-21) cannot pin different experiments. Every seed of the experiment is a fixed
// string, so the census (bin counts, win counts, per-epoch returns) is a deterministic function of this file and the
// dataset: a re-run reproduces it byte for byte; the verifier re-runs it in full and never trusts a statistic the
// artifact reports about itself.

// ── The LIMBO profile's floors (games/limbo/profile.json, LIMBO-20 / LIMBO-21), held apart from the design so a cheaper
// design cannot lower them: the verifier compares the census against THESE, not against the design's own constants.
export const FLOOR_UNIFORMITY_DRAWS = 2_000_000;
export const FLOOR_BAND_BETS = 1_000_000;
export const FLOOR_BANDS = 9;
// The sizes of the two unscored-by-the-profile parts of the design (the long run at 2.00× and the 2,000,000-bet targets),
// held apart from the constants the producer reads for the same reason.
export const FLOOR_CONVERGENCE_BETS = 20_000_000;
export const FLOOR_EDGE_TABLE_BETS = 2_000_000;
export const FLOOR_EDGE_TABLE_TARGETS = 8;
export const FLOOR_PASS2_NONCES = 10_000;

// ── Significance, family-wise ── Pass 1 runs three screens (uniformity, lag-1, runs), each at α/3.
export const ALPHA = 0.01;
export const ALPHA_SCREENS = 3;
export const ALPHA_SCREEN = ALPHA / ALPHA_SCREENS;

// ── Pass 1, draw uniformity + serial independence: 200 fresh seeds × nonces 1..10,000 = 2,000,000 draws u ──
export const PASS1_SEEDS = 200;
export const PASS1_NONCES = 10_000;
export const SIM_UNIFORMITY_DRAWS = PASS1_SEEDS * PASS1_NONCES;   // ≥ 2,000,000 (LIMBO-20 floor)
/** bin = the top 7 bits of u (u >>> 25): 128 bins of exactly 2^25 draw values each, so the screen's equal expected counts
 *  are the exact bin probabilities. */
export const SIM_UNIFORMITY_BINS = 128;
export const SIM_UNIFORMITY_SHIFT = 25;
/** Lag-1 is computed on v = u >>> 16 (0..65535, exact BigInt sums); runs about the median u ≥ 2^31 (exactly half). */
export const SIM_LAG_SHIFT = 16;
export const pass1Seed = (i: number): { server: string; client: string } =>
  ({ server: `housebets-limbo-audit/sim/pass1/server/${i}`, client: `housebets-limbo-audit/sim/pass1/client/${i}` });

// ── Pass 1, the nine targets: 1,000,000 bets each (100 fresh seeds × 10,000 nonces, every target on its own seed labels),
// 1.01× … 10,000×. Targets in hundredths.
export const SIM_EDGE_BETS = 1_000_000;                           // ≥ 1,000,000 per band (LIMBO-20 floor)
export const BAND_SEEDS = 100;
export const SIM_EDGE_TARGETS_H: readonly number[] = Object.freeze([101, 150, 200, 500, 1_000, 5_000, 10_000, 100_000, 1_000_000]);
export const bandSeed = (b: number, j: number): { server: string; client: string } =>
  ({ server: `housebets-limbo-audit/sim/band/${b}/server/${j}`, client: `housebets-limbo-audit/sim/band/${b}/client/${j}` });
/** Convergence marks per band (the convergence rows). */
export const SIM_CONVERGENCE_MARKS: readonly number[] = Object.freeze([10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]);

// ── Pass 1, the long run: 20,000,000 bets at one fixed target, 2.00× (2,000 fresh seeds × 10,000 nonces, its own labels),
// with the running win count kept at the marks below.
export const SIM_LONG_TARGET_H = 200;
export const SIM_LONG_SEEDS = 2_000;
export const SIM_LONG_BETS = SIM_LONG_SEEDS * 10_000;            // 20,000,000 (FLOOR_CONVERGENCE_BETS)
export const SIM_LONG_MARKS: readonly number[] = Object.freeze([1_000, 10_000, 100_000, 1_000_000, 5_000_000, 10_000_000, 20_000_000]);
export const longSeed = (j: number): { server: string; client: string } =>
  ({ server: `housebets-limbo-audit/sim/long/server/${j}`, client: `housebets-limbo-audit/sim/long/client/${j}` });

// ── Pass 1, the edge table: eight targets across the range, 2,000,000 bets each (200 fresh seeds × 10,000 nonces, every
// target on its own seed labels): 1.10×, 1.50×, 2.00×, 5.00×, 10.00×, 20.14×, 100.00×, 1,000.00×. Targets in hundredths.
export const SIM_TABLE_BETS = 2_000_000;                          // FLOOR_EDGE_TABLE_BETS
export const TABLE_SEEDS = 200;
export const SIM_TABLE_TARGETS_H: readonly number[] = Object.freeze([110, 150, 200, 500, 1_000, 2_014, 10_000, 100_000]);
export const tableSeed = (T: number, j: number): { server: string; client: string } =>
  ({ server: `housebets-limbo-audit/sim/table/${T}/server/${j}`, client: `housebets-limbo-audit/sim/table/${T}/client/${j}` });
/** Edge tolerance per band: |RTP_sim − RTP_exact| ≤ 5·SE + 1e-4, SE = σ/√n (src/false-alarm.ts edgeBandFalseAlarm). */
export const EDGE_SIGMAS = 5;
export const EDGE_BUFFER = 1e-4;

// ── Pass 2, cherry-pick: every revealed seed of the five shipped bet files (Phase A 129, its tail 1, Phase C 5, the $10 set 4,
// Phase D 4: 143) × nonces 1..10,000; early window = nonces 1..n, n = the epoch's captured depth (50, the tail 30), reference
// window = n+1..10,000; statistic = the payout-weighted return of the targets the capture actually played in that epoch,
// cycled over the 10,000 nonces, standardized by its exact per-bet mean and variance (win probability = winning draws / 2^32,
// src/rng.ts winningDraws), aggregated across the 143 epochs; pre-registered one-sided lower tail at ALPHA. Every revealed
// seed, as the profile's rule names; a deterministic replay from the revealed seeds, no random draw.
export const SIM_PASS2_NONCES = 10_000;
/** The early window of an epoch: its captured depth (the nonces 1..n the capture played under that seed). */
export const SIM_PASS2_EARLY = (capturedDepth: number): number => capturedDepth;
export const SIM_PASS2_ALPHA = ALPHA;
/** The SCORED slots of Pass 2: played targets up to 100.00× (win chance ≥ 0.99 %). The capture also played targets up to
 *  1,000,000×; one such slot's variance (≈ 10^6 stake units²) swamps the payout-weighted sum, which leaves the all-slot lower
 *  tail unreachable (the same finding as the dice package's 9,900× slots). The excluded slots are still recomputed bet by
 *  bet by LIMBO-07 / LIMBO-11; the all-slot figure is printed, not scored. Decided 13 Oct 2026 from the dice package's
 *  measurement, before the statistic was computed on the live limbo data. */
export const SIM_PASS2_MAX_TARGET_H = 10_000;
/** The SCORED Pass 2 statistic is the per-slot standardised return, the form roulette and keno score — every scored slot's
 *  return minus its target's exact mean, ÷ that target's exact sd, summed and ÷ √slots; for a limbo slot (return = target on
 *  a win, 0 on a loss) this is (win − p)/√(p(1 − p)), p = winning draws / 2^32. Until 14 Oct 2026 this package scored the
 *  pooled form (Σ return − Σ mean)/√Σ var on the same slots; the switch was made after that first result was known, and both
 *  are printed with their p-values. The scored subset (target ≤ 100×) is unchanged. The rule's honest false-alarm rate is
 *  declared in src/false-alarm-pass2.ts. */
export const SIM_PASS2_STATISTIC = 'per-slot standardised return: Σ (win − p)/√(p(1 − p)) over the scored slots, ÷ √slots; p = winning draws of the played target / 2^32';

/** The fresh-seed server seeds are the sha256 hex of these strings (64 hex chars, the platform's seed shape). */
export const FRESH_SEED_RULE = 'serverSeed = sha256(label) as lowercase hex; clientSeed = label';
