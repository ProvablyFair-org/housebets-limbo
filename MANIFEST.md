# HouseBets Limbo — Consolidated Audit Overview (new engine)

**Release:** `v1.0.0` (the first public release) · **Audit ID:** PF-2026-HB06 · **Auditor:** ProvablyFair.org · **Framework:** 1.1

Audit report: https://audit.provablyfair.org/casino/housebets/games/limbo/overview · Public repository:
https://github.com/ProvablyFair-org/housebets-limbo. The machine-readable release identity is
[RELEASE-MANIFEST.json](RELEASE-MANIFEST.json).

Verdict of record: the one `node verify.js` prints, **PROVABLY FAIR — Full Pass**, with one capture-origin FLAG (LIMBO-15,
DL-10), verdict-neutral. Framework 1.1 (Methodology v1.1, 14 Oct 2026): RTP-CLAIM 1.2.0 is switched on, so an RTP figure
overstated on the house side is reported as **RTP FIGURE OVERSTATED** (exit 5), whether the published figure in the
exhibits rises or the computed RTP falls, once the RTP table and the verification record are regenerated and re-pinned; a
committed table or record that no longer equals the run is a reproduction failure, NOT PROVABLY FAIR (exit 1), miss or no
miss. Exit codes under [Reproduce the audit](#reproduce-the-audit).

## Contents

[Conclusion and scope](#conclusion-and-scope) · [Dataset and capture](#dataset-and-capture) ·
[Game and algorithm](#game-and-algorithm) · [Payouts and RTP](#payouts-and-rtp) ·
[Verification results](#verification-results) · [S5 fairness-integrity matrix](#s5-fairness-integrity-matrix) ·
[Player verifiers](#player-verifiers) · [Reproduce the audit](#reproduce-the-audit) · [Evidence](#evidence) ·
[Limitations and trust](#limitations-and-trust) · [Release history](#release-history)

## Conclusion and scope

**PROVABLY FAIR — Full Pass.** Of the profile's 23 scored checks, 22 PASS and 1 is a capture-origin FLAG (LIMBO-15: no
target above the client-side ceiling was sent), 0 FAIL. Every bet in the five shipped bet files (Phase A 6,450, its 30-bet
tail, Phase C 250, the $10 set 200, Phase D 200; 7,130 in all) recomputes exactly from its revealed server seed under the
formula HouseBets publishes, settles by the rules on the game page, matches the server's own raw answer kept beside it,
and appears in the platform's own bet history with the same stake and payout (LIMBO-06, 07, 10, 11, 12, 13, 16). The game
page's own result function (E02), run from the exhibit on every bet's draw, gives the served result on all 7,130
(LIMBO-07). The draw is a full 32-bit value; for every one of the 99,999,900 targets a player can enter (1.01× …
1,000,000×) the chance of winning is within 2^-32 of the published 99 ÷ target % (LIMBO-08).

**Theoretical RTP is 99 % (house edge 1 %) at every target, before the payout is truncated to 1e-8.** The published flat 99 % holds at every target
(0.990000000000 … 0.990232771388 before that truncation, LIMBO-19). Observed return over the 6,450 Phase A bets: 77.1558 % (49.78097455 paid on
64.52005950 staked), variance, not RTP evidence; under the fair game the same bets return a median 61.88 % (100,000 fair
replays, `npm run fair-return`), because most of the 99 % comes from rare high-target wins. Replaying every one of the 143
revealed seeds over 10,000 nonces finds no early-window deficit at the 1 % level on the 3,391 scored slots (per-slot z
−0.180, p 0.4286, LIMBO-21); at this sample that test detects a per-bet RTP deficit of 4.09 pp with 80 % power, not a
smaller one.

Scope: HouseBets House Games **limbo** on the October 2026 engine (fairness version `canonical-v2`), the USDT wallet, one
audit account in a logged-in browser session. Not in scope: other House Games (their own packages), the security of the
platform, a second account, and anything a client-side capture cannot reach (server-side code, concurrency inside the
server).
This package's capture sent no adversarial request to the API apart from one empty client seed (E06) (DL-13); the
fairness-integrity tests, run separately on HouseBets' running service by ProvablyFair.org, are in the ProvablyFair.org
report for this game, Section 5 (Fairness Integrity Testing), and the [S5 matrix](#s5-fairness-integrity-matrix) names them
row by row.

## Dataset and capture

| file | what | bets | seeds |
|---|---|---|---|
| `data/housebets-limbo-phaseA-6450bets.json` | **Phase A, primary**: 129 whole seed pairs of exactly 50 bets, platform minimum stake 0.01000311 USDT, 12 Oct 2026 17:04–19:43 UTC | 6,450 | 129 |
| `data/housebets-limbo-phaseA-tail-30bets.json` | the capture's short last seed pair, own file (DL-1) | 30 | 1 |
| `data/captured/housebets-limbo-sp1-6480bets.redacted.json` | the capture as written, with the audit account's user id replaced by "redacted" (DL-9, `data/REDACTION.txt`); the two files above are split from it unchanged (`src/split.ts`, re-run by LIMBO-05) | 6,480 | 130 |
| `data/supplementary/housebets-limbo-phaseC-250bets.json` | **Phase C**: target 1.98× at 1.000311 (100 × minimum), 13 Oct 2026 | 250 | 5 |
| `data/supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json` | **Phase C, $10 set**: target 1.10× at 10.00, 13 Oct 2026 | 200 | 4 |
| `data/supplementary/housebets-limbo-phaseD-200bets.json` | **Phase D**: one auditor-typed client seed per pair, minimum stake, 13 Oct 2026 | 200 | 4 |

`data/SHA256SUMS` lists the sha256 of every dataset above (`shasum -a 256 -c SHA256SUMS` in `data/`), and `data/SPLIT.txt`
names the split's input and its two outputs with their sha256.

E05 also lists 500 limbo bets of the same account on the same engine, a pilot run of 12 Oct 2026 before the
planned capture; they are not part of the audited population. They are not shipped (their file carries the account's user
id); `npm run excluded` recomputes them (seed hash, result, win, multiplier, payout, the server's answer against the copy)
and they agree 500/500.

The capture ran inside a logged-in browser tab on an account opened for the audit, placing bets through the game's own API
calls. For every seed pair it read the pair (the hash of the server seed and the hash of the next one), drew the client
seed after reading the hash, except on the 4 Phase D pairs, whose client seeds were chosen before the capture (DL-2) (the rig labels the source `node:crypto randomBytes(16) hex` on 139 of 139 Phase A–C seeds;
LIMBO-06 checks that label, not the code that ran), placed 50 bets, read the server's nonce count, and rotated, which
reveals the server seed. A pre-capture read anchors the chain before the first pair. Phase A's 6,450 bets cover fifteen
setting classes (`src/loader.ts` PLAN_CLASSES): log-uniform random targets (4,645 bets) and fourteen fixed targets from
1.01× to 1,000,000× (125–130 bets each); 4,278 distinct targets in all. Every target decade from 1× to 1,000,000× has at
least 130 bets (LIMBO-15). No target above the game's client-side ceiling (1,000,000×) was sent (DL-10). Every bet request
carried only the target, the stake, the currency and a one-time `generation` id (distinct on all 7,130 bets): no client
seed, nonce, payout or multiplier field.

**Capture code** (`capture/`, redacted reference copies, not a runnable tool: the files import each other by paths that
do not exist in this package). Each file starts with a header saying what it is; below it only comments are edited (names,
quotes, internal paths, another audit), the code is unchanged. No scored check reads them.

| file | what | sha256 of the file it was made from | as-run copy |
|---|---|---|---|
| `capture/capture-hb-limbo.mjs` | the limbo rig: the Phase A plan, the bet body, the phases | `e731d083…e0874` | the as-run file of the $10 set (sha256 `e731d083…e0874`, recorded in `data/supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json` meta) is held privately; Phase A ran `a5b18494…` and Phases C and D `4406f42d…`, which were not kept |
| `capture/hb-sp-core.mjs` | the shared capture engine: seed reads, rotation, the empty-seed control | `86266dae…13a2a` | not kept (the datasets record `74a3e47c…` Phase A, `fbc43aa1…` Phases C and D, `d791cce1…` the $10 set) |
| `capture/hb-capture-lib.mjs` | the client-seed generator `csprngClientSeed` (`prefix + randomBytes(16)` hex), credential scrubbing, the commitment witness | `433b6847…b89a8` | not kept (the datasets do not record its hash) |
| `capture/inpage-crypto-shim.js` | what `node:crypto` is inside the browser tab: `randomBytes` and `randomInt` from `crypto.getRandomValues` | `0c1d7af7…c13e8`, nothing below the header edited | not kept (the datasets do not record its hash) |

The shipped files are reference copies, not as-run copies: they show how the client seeds and targets were drawn, not the
exact bytes that ran for every phase (DL-14).

## Game and algorithm

The full specification, with the source of every step, the counts that confirm it and test vectors, is
[docs/ALGORITHM.md](docs/ALGORITHM.md); the module interface of `src/` is [docs/INTERFACE.md](docs/INTERFACE.md).

From HouseBets' published spec (E01, `GET /housegames/limbo/fairness`) and the rules panel of the game page (E02):

- **Draw.** `digest = HMAC-SHA256(key = serverSeed as UTF-8, message = "clientSeed:nonce:0")`; the first 4 bytes, read
  big-endian, are `u` (0 … 2^32 − 1) and `float = u / 2^32`. The key is the seed's 64-character text, not the 32 bytes it
  hex-decodes to: with a hex-decoded key 28 of the 7,130 shipped results match,
  25.4 expected by chance. The four worked examples the spec publishes, with their draws, recompute (LIMBO-09).
- **Result.** `floor(1e8 / (float × 1e8) × 0.99 × 100) / 100`, at least 1.00× and at most 1,000,000× (E01). The game's own
  code holds the same constants (E02: house edge 0.01, minimum target 1.01, cap 1e6, `99 × 2^32 = 425201762304`) and the
  same function, `resultFromUint32V2`, which LIMBO-07 runs from the exhibit on every bet's draw (7,130/7,130 equal to the
  served result). The package's copies of these constants, of the worked examples and of the E03 limits (`src/spec.ts`)
  are held equal to the values parsed from the pinned E01–E03 at every run, 19 of 19 compared; a difference fails
  LIMBO-26.
- **Win rule** (E02, verbatim): "You win when the result is at least your target (compared to the cent). The payout is
  your stake × target." Targets run 1.01× … 1,000,000× in 0.01× steps; "targets above it cannot be entered".
- **Commitment.** The hashed server seed shown before the bets is `sha256` of the seed's UTF-8 text (143 of 143 revealed
  seeds, LIMBO-01; the hex-decoded bytes match 0 of 143); each pair also shows the hash of the next seed, and the chain
  links (LIMBO-02).
- **Nonces** start at 1 on a fresh pair and count every bet (LIMBO-04).
- **Bias.** The result falls as `u` rises, so a target T wins on draws 0 … w−1 for one count w. The package counts w for
  every legal target at the exact boundary `floor(99 × 2^32 / T)` and checks the step there: no target is non-monotone,
  and P(win) never differs from 99 ÷ target % by more than 2^-32 (reached at 78 targets, each a divisor of 99 × 2^32)
  (LIMBO-08). At 40 targets (1.32×, 1.76×, 2.64×, …) the float formula scores the single draw `u = 99 × 2^32 / T` as
  T − 0.01 where exact arithmetic gives T (DL-4).

## Payouts and RTP

- **Win chance** = 99 ÷ target, in percent (E02). Confirmed by counting the winning draws by bisection over all 2^32 values
  for each of the 4,425 distinct targets served (LIMBO-18). The server's own `winChance` field equals 99 ÷ target rounded to
  8 decimals on 7,130 of 7,130 bets; it is compared, never used.
- **Multiplier** on a win = the target itself (E02 "The payout is your stake × target"): 922 of 922 winning Phase A bets and
  345 of 345 winners of the tail and supplementary sets (LIMBO-13). The edge sits in the result formula's 0.99, not in the
  payout.
- **Payout** = stake × target, truncated to the wallet's 1e-8 unit; exact at 8 decimals on 6,450 of 6,450 Phase A bets and
  680 of 680 tail and supplementary bets (LIMBO-11, LIMBO-12). Every money value and every result is checked on its grid
  (1e-8; the 0.01× lattice) as served, before any rounding: 0 off the grid (LIMBO-07, 11).
- **Max win** (E02 rulesMaxWin): "A round pays at most {cap}. A bet whose win would exceed the cap is refused — not
  reduced". With E03's wallet limits the cap is 1,000,310.0961298 USDT and the max bet 20,006.20192259 USDT; max bet ×
  1,000,000× = 20,006,201,922.59, so the refusal is reachable within the bet limits. This capture placed no bet near the
  cap (largest payout 19.30850307 USDT), and the target ceiling is enforced in the game's code (E02 clampTarget); no target
  above it was sent, so whether the server also enforces it is not known. The cap and the clip are declared, which is what
  LIMBO-14's rule asks; the two branches the capture never produced are declared unwitnessed (DL-10), and LIMBO-14 scores
  PASS.
- **RTP.** The figure is stated in two of the rule's places in the evidence. The rules: the rules panel text in the game's
  page code, "RTP is 99% at every target; the house edge is 1%." (E02; the rendered panel was not captured, P-2). HouseBets
  reworded that line after the capture: the live copy of the same bundle (fetched 19 Oct 2026, last-modified Fri, 16 Oct 2026
  09:18:09 GMT) reads "Theoretical RTP before payout rounding: 99% (1% house edge)." (E07); the figure is unchanged. The game
  settings the site loads: the fairness answer, `houseEdge` 0.01 and "A target t is reached with probability 0.99 / t: a 1%
  edge at every target." (E01). LIMBO-19 reads the figure from all three exhibits at every run, never from a copy in the code,
  and tests the highest one stated. Exactly, the RTP of a target T is w(T) × m(T) / 2^32, with m(T) the payout rule's
  multiplier (the target itself, `src/rules.ts` `multiplierH`): across all 99,999,900 targets it runs from 0.990000000000
  (target 1.32) to 0.990232771388 (target 999769.01), never below 99 % before the payout is truncated to 1e-8. Under the framework rule RTP-CLAIM 1.2.0 (switched
  on, Methodology v1.1) the claim holds: 0 targets beyond the 0.1 pp band on either side (`outputs/rtp-claim-table.json`,
  LIMBO-19 scores PASS). The truncation of each payout to 1e-8 depends on the stake and is not in that table.
- **No scaling edge.** The spec carries one flat house edge 0.01 and no scaling block; every winner at the three stakes
  captured (0.01000311, 1.000311, 10) was paid exactly its target, 1,267 of 1,267 (LIMBO-31).
- **Simulation.** Three parts, every target on its own fresh seeds. Nine targets of 1,000,000 bets, 1.01×, 1.5×, 2×, 5×,
  10×, 50×, 100×, 1,000× and 10,000×, each land within their tolerance |RTP_sim − RTP_exact| ≤ 5·SE + 0.0001, SE = σ/√n
  (worst 1.42 SE; width from 0.00080 at 1.01× to 0.49757 at 10,000×). A run of 20,000,000 bets at 2.00× returns
  99.0026 % against the exact 99.0000 % (|Δ| 0.000026, width 0.001218, SE 0.0224 pp). Eight targets of 2,000,000 bets,
  1.1×, 1.5×, 2×, 5×, 10×, 20.14×, 100× and 1,000×, each land within the same tolerance (worst 2.82 SE; width from
  0.00127 to 0.11129). LIMBO-20 prints every target's |Δ| and width. **Ten of the seventeen targets are wider than the
  1 % house edge** (5×, 10×, 50×, 100×, 1000×, 10000× at 1,000,000 bets; 10×, 20.14×, 100×, 1000× at 2,000,000 bets):
  those targets alone cannot detect an edge of that size, and no target above 10,000× is simulated (DL-12); the RTP
  evidence there is the exact table (LIMBO-19). Live-bet returns are variance only; RTP evidence is the exact table and the
  simulation.

## Verification results

`node verify.js` runs the 31 checks of the framework's LIMBO profile, the public profile `games/limbo/profile.public.json`
version 1.0.4-public (the public form of profile 1.0.4: the same checks with the same ids, names, layers, kinds, policies,
parameters and floors; internal references are removed from the text), sha256
`c5a7be5e09e5c94846e19e7c9b6619e358d005c5c0614bdacdc697e59abbb530`. The file ships byte for byte at
`profile/profile.json` and is pinned in the verifier itself: the scored list and each check's policy come from it, and
`src/profile-map.ts` must equal it row for row (id, name, layer, kind, policy), or the verdict is withheld (INCOMPLETE,
exit 3). Node 22.23.1: 22 of 23 scored checks PASS, 1 capture-origin FLAG (LIMBO-15), 0 FAIL, 0 not run; LIMBO-22
informational; package checks 7 of 7 PASS; verdict **PROVABLY FAIR — Full Pass**. The committed record and
RELEASE-MANIFEST.json count 21 passes: they leave out LIMBO-27, the check that compares the record with the run. The full
per-check output is `outputs/verification-results.json`. That record holds every check of the run except LIMBO-27,
LIMBO-28 and LIMBO-29, which attest the record itself: LIMBO-27 compares it with the run, and LIMBO-28 and LIMBO-29 read the
gate records (`outputs/fresh-copy.json`, `outputs/mutation-results.json`), which are bound to sources that pin the record
(`src/artifact-pins.ts`); verify prints those three and does not record them.

| check | status | result |
|---|---|---|
| LIMBO-01 seeds | PASS | 143/143 revealed seeds hash to their commitments (129 Phase A) |
| LIMBO-02 chain | PASS | 128/128 Phase A links, pre-capture anchor, Phase A → tail, tail → the pair active after the capture; supplementary chains anchored |
| LIMBO-03 / 04 | PASS | 129/129 pairs: one hash and client seed per pair; nonces exactly 1..50, N == the server's count |
| LIMBO-05 population | PASS | 6,450 / 129 / 129 × 50 against code constants; the split re-run reproduces both files byte for byte |
| LIMBO-06 client seed | PASS | a wrong client seed changes 6,434/6,450 results (16 same-result collisions, 23.0 expected); Phase D 200/200 recompute under 4 player seeds; the empty-seed request was answered HTTP 400 with a generic error (E06) |
| LIMBO-07 / 10 / 11 / 13 | PASS | results, win rule, payouts 6,450/6,450 Phase A and 680/680 tail + C + C $10 + D; the game page's own result function (E02) == the served result 7,130/7,130; multipliers 922/922 and 345/345; capture copy == server round record and == the server's raw answer, every bet |
| LIMBO-08 | PASS | every legal target: P(win) within 2^-32 of 99 ÷ target % |
| LIMBO-09 | PASS | the 4 worked examples of E01 recompute; a captured winner recomputes |
| LIMBO-12 | PASS | Phase C 250/250 (132 wins) and the $10 set 200/200 (178 wins) recompute and pay by the base rule |
| LIMBO-14 | PASS | targets on the 0.01× grid in range 7,130/7,130; result cap and maximum win declared (E01, E02, E03); 1,000,000× playable at the minimum stake and played 130 times; declared unwitnessed: the max-win refusal (reachable within the bet limits, never produced) and the client-side target ceiling (never probed) (DL-10) |
| LIMBO-15 | FLAG (capture) | 15 plan classes ≥ 50 (min 125), every decade ≥ 130; the profile's "targets on both sides of a client-side cap" is not covered (DL-10); a planned target refused by the server with a non-transient answer would make this an operator FLAG (0 such; 20 transient, DL-1) |
| LIMBO-16 | PASS | 7,130/7,130 package rounds in the platform's bet history with the same stake, payout and status (E04); the full `reconcile-full.py` output (E05) checked by its numbers: every row's net == paid − staked, TOTAL == the rows, 86,979 entries == 86,966 captured + 0 open + 13 of 10 Oct, this package's 4 rows == the sums of its own datasets, balance before == after − net (986.84718000, the run's --before argument, DL-11); the pass rests on that bet history and that account reconciliation: the comparison of consecutive balances the profile describes was not possible in this capture (DL-8) |
| LIMBO-17 | PASS | 10/10 ties paid, 121/121 results at the 1.00× floor lost; the 1,000,000× cap declared unwitnessed: no result reached it in this capture (DL-3) |
| LIMBO-18 / 19 | PASS | bisection count == the package's count for 4,425 served targets; RTP claim holds (above) |
| LIMBO-20 | PASS | 2,000,000 draws: chi² 112.74 (df 127) p 0.8128, lag-1 z −1.944, runs z 1.068; 9/9 targets of 1,000,000 bets, the 20,000,000-bet run at 2.00× and 8/8 targets of 2,000,000 bets in tolerance (ten of the seventeen targets wider than the edge, DL-12) |
| LIMBO-21 | PASS | 143 revealed seeds (Phase A 129, tail 1, C 5, $10 4, D 4) × 10,000 nonces, early window = each pair's captured nonces: scored (per-slot standardised) early-window z −0.180, p 0.4286 over the 3,391 scored slots; power: a 4.09 pp per-bet RTP deficit at 80 %. Printed, not scored: the 129 Phase A seeds alone z −0.457, the other 14 z 0.590; the pooled form z −0.077, p 0.4694, power 21.79 pp (the scored form was switched from pooled to per-slot on 14 Oct 2026, after the pooled result on the Phase A seeds was known). 101 epochs below expectation, 42 at or above; under fair play 99.2 ± 5.47 are below (descriptive, not a test) |
| LIMBO-22 | INFO | 6,450 live results: 112 at the 1.00× floor vs 127.7 expected; KS p 0.3047 |
| LIMBO-23 | PASS | the S5 matrix below carries the framework's ids and names, S5-1 … S5-8, each with a status |
| LIMBO-24 | PASS | `site-verifier/derive.js`, sha256 `a375ed511eec67360ea34b21c22ee2a4742267c46c6b83263135e65d3cd9577a`, generated from `src/rng.ts`: equals its pins (`src/artifact-pins.ts`, RELEASE-MANIFEST.json) and returns what `src/rng.ts` returns on all 7,130 captured bets (50,053 calls, 0 differing results) ([Player verifiers](#player-verifiers)) |
| LIMBO-25 | PASS | README "Verify a bet": where the seed is revealed, the fields, the commitment, the HMAC key's encoding and the result formula |
| LIMBO-26 / 27 | PASS | 6 datasets, 7 exhibits, the vendored profile and 3 artifacts match their pins; the `src/spec.ts` constants equal the values parsed from E01–E03 (19/19); the user id is redacted in every shipped dataset (13,610 "redacted", 0 other values, DL-9); regenerated census, RTP table and verification record == committed; `verify.js` built from the current sources |
| LIMBO-28 / 29 | PASS | read only from the committed, pinned records `outputs/fresh-copy.json` and `outputs/mutation-results.json` (RELEASE-MANIFEST), produced from the current sources; audit ID PF-2026-HB06; a record that is missing or is not the bytes its pin names prints FAIL and fails the verdict (exit 1) |
| LIMBO-30 | PASS | the limitations register, the premises table and every exhibit E01–E07 by file name |
| LIMBO-31 | PASS | no scaling edge (above) |

**LIMBO-14 and LIMBO-17 are scored by the profile's rule text.** LIMBO-14's rule asks that every target lie on the
declared precision and range, that the result cap and the maximum-payout clip be declared, and that an unplayable
advertised maximum or a client-side ceiling the server does not enforce be disclosed; LIMBO-17's rule asks that the tie,
the floor and the cap be witnessed by data or probes with their counts, and that a case asserted from source alone be
declared unwitnessed, never passed silently. Nothing here contradicts either rule: the targets are in range, the cap and
clip are declared, the 1,000,000× maximum is playable, every witnessed tie and floor settled as published, and each branch
the capture never produced is declared unwitnessed in the check's own output and in DL-3 and DL-10. Another ProvablyFair.org
limbo audit scores the same situation the same way. LIMBO-15 stays a capture-origin FLAG: its rule asks Phase A to cover
targets on both sides of a client-side cap where the operator has one, and HouseBets has one that this capture did not
cross.

### False-alarm rates

Pass 1 uniformity screen 0.0033 (α/3 by construction, 128 equal bins of 2^25 values); each Pass 1 target and the 20,000,000-bet run ≤ 1.7 × 10^-6 (exact binomial), any of them 8.0 × 10^-6;
Pass 2, the scored per-slot rule over the 3,391 scored slots of the 143 revealed seeds, 0.00946 ± 0.000216 (standard
error; `src/false-alarm-pass2.ts`, 200,000 honest replicates over those slots, re-derived by `npm run false-alarm:pass2`,
not re-run by verify); the pooled rule on the same replicates 0.005 ± 0.000158. Each is below the 1 % cap for a failing
step.

## S5 fairness-integrity matrix

S5: fairness-integrity matrix.

<!-- S5-MATRIX:BEGIN -->
| Test ID | Category | What the framework tests | Result | Tied to |
|---|---|---|---|---|
| S5-1 | Replay protection | A completed bet cannot be replayed to duplicate a payout | Pass | HB-LIMBO-REPLAY-001, HB-LIMBO-EXTRA-001: Identical bets sent in parallel, with and without a shared request key, settled one round per pair, and a reused request key returned the identical round with no second bet. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no replay request was sent. Observed only: each of the 7,130 bets was sent with its own `generation` id (7,130 distinct) and settled once, with one round id (7,130 distinct) and one bet-history row (LIMBO-16, E04). DL-13 |
| S5-2 | Input validation | Invalid, out-of-range or malformed parameters are rejected | Pass | HB-LIMBO-PARAM-001, HB-LIMBO-PARAM-003, HB-LIMBO-SEED-001: Out-of-range, over-precise and non-numeric targets, a target array, alias fields, malformed request keys and invalid client seeds were rejected. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: the capture sent valid targets only. Observed only: one request with an empty client seed was refused, HTTP 400 with a generic error (E06, LIMBO-06). DL-13 |
| S5-3 | Seed integrity under adversarial input | Server and client seed fields cannot be injected or overridden via the API | Pass | HB-LIMBO-MAXWIN-002: Bets each carrying one injected outcome field (outcome, win chance, nonce, seed or payout) were rejected and none was honoured; the control and recovery bets recomputed from the revealed seed. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no injection was attempted; no bet request carried a seed field. Observed only: every bet carries its pair's committed hash and client seed in the server's answer (LIMBO-03), and the four typed Phase D seeds are the ones the results recompute with (LIMBO-06). DL-13 |
| S5-4 | Cross-player isolation | One player's seeds, nonces or outcomes are not observable or influenced by another | Pass on 1 of 2 controls; 1 not tested | HB-LIMBO-AUTH-001: Bets carrying foreign and malformed user identifiers were rejected; the control bet stayed in the caller's own seed and balance chain and no bet was attributed to another account. Not covered: observation by another account was not tested; influence was tested from one account, by sending another account's identifier. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: single audit account (EC-9). DL-13 |
| S5-5 | Payout field integrity | Client-supplied payout or multiplier values are ignored by the server | Pass on 1 of 2 controls; 1 not tested | HB-LIMBO-MAXWIN-002: Bets each carrying one injected outcome field (outcome, win chance, nonce, seed or payout) were rejected and none was honoured; the control and recovery bets recomputed from the revealed seed. Not covered: no multiplier field was injected (payout only). Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no bet request carried a payout or multiplier field. Observed only: every payout equals floor(stake × target) at 1e-8 (LIMBO-11, 12, 13). DL-13 |
| S5-6 | Nonce sequence enforcement | Nonces cannot be forced, replayed or skipped via the API | Pass (a finding in HB-LIMBO-RACE-001 was fixed by HouseBets and re-tested) | HB-LIMBO-NONCE-001, HB-LIMBO-NONCE-002, HB-LIMBO-NONCE-003, HB-LIMBO-RACE-001, HB-LIMBO-RACE-003, HB-LIMBO-MAXWIN-002: Bets carrying reused, skipped-ahead, boundary and malformed nonces, or an injected nonce field, were rejected at validation and the sequence continued by one; under bursts of parallel bets accepted nonces were unique and in sequence. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no bet request carried a nonce. Observed only: nonces run 1..50 with no gap, repeat or reorder in all 129 Phase A pairs and equal the server's count at rotation (LIMBO-04); the 20 transient refusals used no nonce (DL-1). DL-13 |
| S5-7 | Parameter boundary enforcement | Bet amounts, configuration values and game parameters outside valid ranges are rejected | Pass | HB-LIMBO-PARAM-001, HB-LIMBO-PARAM-004, HB-LIMBO-MAXWIN-001, HB-LIMBO-MAXWIN-003: Targets below the minimum, at or below 1.00×, zero, negative, above the maximum and overflow-sized, stakes whose potential payout exceeds the max-payout cap and stakes just above the maximum bet were refused; real bets at the lowest target and at 1,000,000× settled. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: no out-of-range target or stake was sent. Observed only: the minimum target 1.01× and the maximum 1,000,000× were accepted (LIMBO-14, 15); whether the server refuses a target above the client-side ceiling, and the max-win refusal, were not tested (DL-10). DL-13 |
| S5-8 | Game-specific state | For Limbo: a seed rotation racing a bet in flight cannot change the seed it settles on | Pass | HB-LIMBO-EXTRA-002, HB-LIMBO-RACE-004: With rotations fired against bets in flight and bets sent around a rotation, no revealed seed reappeared as an active seed and no bet settled on a revealed seed. Report, Section 5 (Fairness Integrity Testing). This package's own capture, separately: Limbo settles in one request; the capture placed one bet at a time and never raced a rotation against a bet. Observed only: every bet recomputes under the seed committed for its pair (LIMBO-07). DL-13 |
<!-- S5-MATRIX:END -->

Of the eight framework rows, **6 pass on every control the row names**, **2 pass on part of the controls they name** (S5-4,
S5-5: the row's status says how many of its controls were tested, and its evidence cell what was not) and none remains Not
tested. In one of the passing rows a finding was fixed by HouseBets and re-tested. The passing rows rest on
fairness-integrity tests run separately on HouseBets' running service by ProvablyFair.org; they are recorded in the
ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing), not in this package's data, so nothing in
this package reproduces them. The matrix names 17 of that section's 31 tests, each under the row whose control it tests; the
other 14 tests check controls outside these eight rows (1 of them recorded there as fixed by HouseBets) and are in the
report only. This package's own capture recorded normal play and sent no adversarial request to the API; the one empty
client seed of E06 is its only out-of-spec request. The "Observed only" notes state what the captured data shows; none
substitutes for the adversarial test, and reproducing a test from this package needs a deliberate probe capture (DL-13).

The offline consistency checks below are this audit's own ids, not the framework's S5 rows (they were S5-1 … S5-8 before
this release, which collided with the framework ids):

| Check | Category | What was tested | Result | Finding |
|---|---|---|---|---|
| EC-1 | Seed substitution | Can a revealed seed be swapped for a better one that still matches the commitment? | Pass | 143/143 seeds hash to their commitments and the chain links in order from a pre-capture anchor; these are consistency checks, the timing rests on the capture's reads before each pair (P-1). [LIMBO-01, LIMBO-02] |
| EC-2 | Client-seed manipulation | Does the client seed enter the derivation? | Pass | 6,434/6,450 results change under a wrong client seed (16 collisions, 23.0 expected from the result distribution); Phase D 200/200 recompute under player-set seeds, 199/200 differ from the previous seed's results. [LIMBO-06] |
| EC-3 | Stake-conditional outcome | Do the captured higher-stake bets recompute and settle by the same rule as the base stake? | Pass | Phase C at 100 × minimum (250 bets) and the $10 set (200 bets) recompute and pay by the same rule as base stake; the derivation takes no stake input. [LIMBO-12, LIMBO-31] |
| EC-4 | Server-seed cherry-picking | Can the operator pre-select seeds unfavourable for the early nonces? | Pass, structural + statistical | The result depends on the client seed, set after the hash is shown (P-1): drawn after the read on 139 of 143 pairs; the 4 Phase D client seeds were chosen before the capture (DL-2), so the structural argument does not cover those pairs, which are in the Pass 2 screen; Pass 2 over all 143 revealed pairs × 10,000 nonces: per-slot early-window z −0.180, p 0.4286 on the 3,391 scored slots (DL-7), detection power 4.09 pp per bet. Nothing here rules out selection across the capture as a whole; the four Phase D pairs had predictable client seeds (DL-2), and Pass 2 is their cherry-pick check. [LIMBO-21, LIMBO-06] |
| EC-5 | Seed-rotation race | Can a rotation during an in-flight bet change its seed? | Not tested — disclosed | Limbo settles in one request; no result is pending against an unrevealed seed. The capture places one bet at a time per game, so the capture did not exercise a concurrent rotate/bet race; the tests named under S5-8, run separately on HouseBets' running service by ProvablyFair.org, did. |
| EC-6 | Multiplier tampering | Is any win credited at a multiplier other than the target? | Pass | Recomputed from the setting alone and compared with the served multiplier: 922/922 Phase A winners, every supplementary winner; payouts exact. [LIMBO-13, LIMBO-11] |
| EC-7 | Nonce manipulation | Are nonces skipped, reused or reordered? | Pass | 129/129 pairs run exactly 1..50 with the server's count equal to 50; the capture's skipped requests used no nonce (DL-1). [LIMBO-04] |
| EC-8 | Range-mapping bias | Does the draw-to-result map favour some outcomes? | Pass | Exact winning-draw count for all 99,999,900 targets: worst deviation from 99 ÷ target % is 2^-32. [LIMBO-08] |
| EC-9 | Scope limitation | Multi-account seed sharing | Not tested | Single account; a future audit item |

## Player verifiers

The ProvablyFair.org verifier for HouseBets is at
[provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets). The module it runs for this
game ships in this release as `site-verifier/derive.js`, sha256
`a375ed511eec67360ea34b21c22ee2a4742267c46c6b83263135e65d3cd9577a`. The live verifier serves exactly these bytes.

**How the module is built.** `npm run build:site-verifier` (`scripts/build-site-verifier.mjs`, bun 1.3.9) bundles
`src/rng.ts` and the constants it imports from `src/spec.ts` into one ES module with no import, which exports the same
functions under the same names (`boundaryDraw`, `drawU`, `hmacBlock`, `resultExactH`, `resultFromU`,
`resultHundredths`, `sha256Hex`, `winningDraws`) and runs in a browser and in Node. `src/rng.ts` takes SHA-256 and
HMAC-SHA256 from Node; a browser page has no such module, so the build puts its own implementation of the two inside the
file. Nothing else differs from `src/rng.ts`. The same sources give the same bytes: the file's header carries the sha256
of both source files and no date, host or path, the bun version is fixed, and `node scripts/release-manifest.mjs --check`
rebuilds the module in a throwaway folder and requires the shipped file to equal the rebuild byte for byte.

**What LIMBO-24 checks, on every run.** The file on disk has the sha256 pinned in `src/artifact-pins.ts`
(`SITE_VERIFIER_PIN`) and in RELEASE-MANIFEST.json, and this document and the README quote it. The module is then loaded
from that file and run side by side with `src/rng.ts` on every captured bet of the five shipped datasets (the two
functions that take a target are called with each bet's own target): 7,130 bets and 143 revealed seeds,
50,053 calls over its eight functions, 0 differing results. Two mutations cover the check (`tests/mutations.json`):
M24a drops the 0.99 factor from the result formula inside the module and re-pins it everywhere, so only the side-by-side
run can catch it; M24b breaks the pin and leaves the module alone. To confirm the bytes a page serves, compare the sha256
of the module it loads with the one above.

HouseBets' own verify tab was not tested against this package beyond its `/unhash` seed lookup (DL-6); the game page's
own result function is run on every bet (LIMBO-07). README.md "Verify a bet" carries the player steps by hand, with a
runnable function and a worked example.

## Reproduce the audit

`node verify.js` on Node 22, or `npm test` on Node 22.6 or later, with nothing installed; `verify` re-runs the whole simulation (78 s
measured on an Apple M2 Max, 12 cores, Node 22.23.1, at load average 9; it prints its own `runtime` last). Re-generation of the artifacts of record:
`npm run simulate` (the census, `outputs/simulation-results.json`), `npm run rtp-claim:write` (the RTP table),
`npm run record` (the verification record) — each re-pinned in `src/artifact-pins.ts` (and `src/rtp-settings.ts`) in the
same change; `npm run build:site-verifier` rebuilds `site-verifier/derive.js` from `src/rng.ts` and writes its pin; then `npm run build:standalone` (verify.js carries the digest of the sources it was built from; LIMBO-27 fails a
stale bundle under `npm run verify`, and a stale `verify.js` itself exits 4 with no verdict). `npm run false-alarm:pass2`
re-derives the declared Pass 2 rates. `npm run mutate` runs the mutation battery in throwaway copies against an unmutated
control copy and writes the committed record `outputs/mutation-results.json`; `npm run gate:fresh` runs the package from a
fresh copy and writes `outputs/fresh-copy.json`; `npm run release-manifest` then pins both, with every other file of the
package except RELEASE-MANIFEST.json itself (LIMBO-28/29 read only those pinned records, and only
when each carries the sha256 of the script that wrote it). A mutation that names the exit it must end in is killed only
with that exit: an RTP miss with the table and record regenerated must end in RTP FIGURE OVERSTATED (5), the same change
without regeneration in NOT PROVABLY FAIR (1), and the deleted-step mutation with its record regenerated in INCOMPLETE (3).
M21c covers the all-seed Pass 2, M07e the page's result function, M23 renames an S5 row. `npm run excluded -- <file>`
recomputes an excluded workshop capture file; `npm run fair-return` prints the observed return and its fair-play
distribution (README).

A release-gate record that is missing or is not the bytes RELEASE-MANIFEST.json pins fails the verdict (exit 1), and every
mutant copy reads the fresh-copy record, so the records are regenerated in this order: `npm run build:standalone`,
`npm run gate:fresh`, `npm run release-manifest`, `npm run mutate`, `npm run release-manifest`. LIMBO-24 reads the
module's pin from RELEASE-MANIFEST.json, so after a change of `src/rng.ts` or `src/spec.ts` these come first:
`npm run build:site-verifier`, `npm run release-manifest`. `node scripts/release-manifest.mjs --check` compares every pin
with the file on disk and rebuilds `site-verifier/derive.js` from `src/rng.ts` in a throwaway folder (bun 1.3.9), requiring
the shipped module to equal the rebuild byte for byte.

**Bundler version.** `verify.js` was built with bun 1.3.9; its header and RELEASE-MANIFEST.json (`toolchain.bun`) record
it. Another bun version can name local variables differently and produce different bytes from the same sources; the
bundle's behaviour does not depend on it, and `node verify.js` itself refuses to run (exit 4) when its sources differ from
the ones it was built from.

Exit codes of `node verify.js` / `npm run verify`, the same in all 11 HouseBets new-engine packages (the ranking of
RTP-CLAIM 1.2.0, `rtpClaimVerdict`): 0 PROVABLY FAIR — Full Pass · 2 PROVABLY FAIR — Conditional Pass · 5 RTP FIGURE
OVERSTATED · 3 INCOMPLETE · 1 NOT PROVABLY FAIR · 4 `verify.js` is a stale build of the sources beside it (no verdict). When
more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass. No label,
FLAG or claimed-figure test runs ahead of the RTP rule; a committed RTP table or verification record that no longer equals
the run is a reproduction failure (exit 1) whether or not the rule reports a miss, so an RTP miss reads exit 5 once both
are regenerated and re-pinned.

## Evidence

| exhibit | file | role |
|---|---|---|
| E01 | `evidence/E01-limbo-fairness-spec-2026-10-12.json` | the server's published limbo spec (RNG, result formula, range, win rule, four worked examples with their draws) |
| E02 | `evidence/E02-limbo-rules-panel-2026-10-10.json` | the game page's rules panel text, constants and functions (win rule, win chance, RTP claim, cap, maximum win, the result function LIMBO-07 runs), with the bundle's hash |
| E03 | `evidence/E03-limbo-limits-2026-10-12.json` | the limits answer: minimum stake 0.01000311 USDT, maximum win 1,000,310.0961298 USDT, wallet decimals 8 |
| E04 | `evidence/E04-limbo-bet-history-2026-10-13.json` | the platform's bet-history rows of all 7,130 package rounds |
| E05 | `evidence/E05-account-reconcile-2026-10-13.txt` | the full output of the workshop's `reconcile-full.py` on the final ledger: every capture file of the 11 games (this package's four, 7,130 rounds, and the 500 limbo bets of the pilot run described under [Dataset and capture](#dataset-and-capture)), 86,979 history entries = 86,966 captured rounds + 13 bets of 10 Oct, 0 unexplained; the before-balance it derives (wallet after − net + open stakes) equals the run's `--before` argument, 986.84718000 (DL-11) |
| E06 | `evidence/E06-limbo-empty-seed-control-2026-10-13.json` | one request with an empty client seed, answered HTTP 400 with a generic error (`{"error":"an error occurred"}`); nothing was read afterwards |
| E07 | `evidence/E07-limbo-rules-panel-live-2026-10-19.json` | the same rules panel text in the live copy of the game page's bundle, fetched 19 Oct 2026 (last-modified Fri, 16 Oct 2026 09:18:09 GMT, sha256 and etag recorded), with every key changed since E02 (the RTP line reworded; Min bet / Max bet lines replace the bet-range line); LIMBO-19 reads its figure |

`scripts/make-evidence.py` records the source path and sha256 of each exhibit; `scripts/make-live-rules.py` builds E07 from the
live bundle copy of 19 Oct and stops unless its reading reproduces every key of E02 from the 10 Oct copy.

## Limitations and trust

### Load-bearing premises

| ID | Premise | Why it holds | Could the data contradict it? |
|---|---|---|---|
| P-1 | Each commitment was shown before its bets. On the 139 of 143 pairs whose client seed the capture drew (every pair outside Phase D), the seed was drawn after the commitment was read; the 4 Phase D client seeds were chosen before the capture (DL-2), and each of their commitments was read before the pair's first bet | The capture read the hash, then drew the seed, then bet; timestamps logged per pair | Partly: a commitment that did not match its revealed seed would fail LIMBO-01; the order of reads is the capture's record, not the server's |
| P-2 | E02 is the text players see | The bundle E02 was cut from is the one the live limbo page loaded, checked 10 Oct 2026; E07 is the same URL's copy of 19 Oct (that the live page still loads it was not re-checked) | No: the rendered panel was not captured; a different panel would not show in the data |
| P-3 | The served result is the published binary64 formula, not the exact rational one | Both agree on every bet of the five shipped files (7,130/7,130, LIMBO-07); they differ only on one draw at 40 targets (DL-4) | Yes, in principle: a captured bet on one of those 40 draws would show which one the server runs; none occurred |
| P-4 | The account was used only by the capture | E05: the history holds the captured rounds and 13 earlier bets, nothing else | Yes: any other bet would be an unexplained history entry |

### Declared limitations register

| ID | Limitation | Effect | Closure / evidence |
|---|---|---|---|
| DL-1 | The capture rig skipped 20 limbo bets the server answered with a transient 400 "Transaction temporarily unavailable", so the last seed pair of the capture holds 30 bets, not 50 | Verdict-neutral: no nonce was used (LIMBO-04); those 30 bets are in their own file (`data/…tail-30bets.json`) and the verifier recomputes them (LIMBO-07, 10, 11, 13) and replays their seed in Pass 2 (LIMBO-21) | The supplementary sets (13 Oct) have 0 skips |
| DL-2 | Phase D client seeds are predictable strings chosen by the auditor (`provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890`) | All 4 Phase D pairs are exposed to an operator who could foresee them; Phase D tests recomputation, not unpredictability | Pass 2 replays the four Phase D seeds with the rest (LIMBO-21); Phases A–C seeds carry the rig's CSPRNG source label, `node:crypto randomBytes(16) hex` (139/139, LIMBO-06: a label check; the generator is in `capture/hb-capture-lib.mjs`) |
| DL-3 | No result in this capture reached the 1,000,000× cap (a draw does so with probability 4,253 / 2^32) | LIMBO-17 declares the cap unwitnessed; the cap is taken from E01/E02 and the formula | Ties (10/10 paid) and the 1.00× floor (121/121 lost) were witnessed and settled as published |
| DL-4 | At 40 targets the published float formula and exact arithmetic differ on one draw (`u = 99 × 2^32 / T`, probability 2^-32) | The package follows the published formula; at those targets P(win) is exactly 99 ÷ target % | LIMBO-08 lists them; LIMBO-19's RTP minimum (0.99 at 1.32×) is one of them |
| DL-5 | Commitment timing rests on the capture's reads (P-1) | Hash equality is a consistency check | — |
| DL-6 | The player-facing reveal path was observed in the API and the game's code, not on the rendered verify screen | README "Verify a bet" steps 1–2 are scoped to that; where the screen shows the hashed seed was not checked | — |
| DL-7 | Pass 2 scores the played slots at targets ≤ 100× (3,391 of 7,130). The subset was set for the pooled form, where the slots above (up to 1,000,000×) leave the all-slot test powerless (pooled, all slots: z −0.064); it is kept unchanged under the per-slot form scored since 14 Oct 2026 | The all-slot per-slot statistic is printed, not scored (z −0.165, p 0.4344, power 5.83 pp); every unscored slot is recomputed by LIMBO-07/11 | `src/sim-config.ts` records the subset as decided on 13 Oct before the statistic was computed on the live data; no artifact orders the two |
| DL-8 | The per-bet balance field cannot be checked bet to bet: 8 games were captured at once | Reconciliation uses the platform history (E04) and the account wallet (E05) instead | E05 RECONCILED |
| DL-9 | The datasets ship with the audit account's HouseBets user id replaced by the string "redacted" (`bets[]._raw.game.userId`, one per bet: 13,610 values across the shipped data files; the other userId fields hold the nil UUID, 40,830 values, unchanged) | No check uses the user id and every other byte is as captured. The as-captured files are not shipped: they stay in the HouseBets workshop, and `data/REDACTION.txt` gives each one's sha256 next to the shipped file's sha256; `node scripts/redact-user-id.mjs <as-captured> <out>` reproduces the shipped bytes (a text substitution of that one value) | LIMBO-26 requires every bet's `_raw.game.userId` == "redacted" and no other userId value |
| DL-10 | Two declared branches were never exercised: the max-win refusal (E02 rulesMaxWin), reachable within the bet limits, and targets above the game's client-side ceiling (E02 clampTarget), which were never sent | LIMBO-14 declares both unwitnessed (it scores PASS: its rule asks for them to be declared); LIMBO-15 is a capture-origin FLAG, because its rule asks for targets on both sides of a client-side cap | Witnessing them needs a stake large enough to win more than the cap and a request with a target above 1,000,000×; neither was placed |
| DL-11 | E05's 8-dp balance before the capture, 986.84718000, is the `--before` argument the reconcile run was given; the exhibit shows only that wallet after − net + open stakes equals it. The workshop records that figure as read from the page header before the first bet; that screenshot was not kept | The before-balance has no surviving independent exhibit; the first answer E05 prints (986.8372, 12 Oct 13:31:59.103Z) is to a bet placed before every limbo bet in the capture files E05 lists (the earliest of those, the 500-bet pilot run, starts 2026-10-12T13:32:45.846Z, `npm run excluded`), so this package holds no bet it can be tied to | LIMBO-16 checks every figure E05 does show by arithmetic, and the last answer's 4-dp balance against the 8-dp balance after |
| DL-12 | Six of the nine 1,000,000-bet Pass 1 targets (5× and up) and four of the eight 2,000,000-bet targets (10× and up) have a tolerance wider than the 1 % house edge; no Pass 1 target is above 10,000× | Those targets alone cannot detect an edge of 1 %; they test gross misbehaviour only. The 20,000,000-bet run at 2.00× has a tolerance of 0.1218 % | The exact RTP of every target (LIMBO-19) carries the RTP claim |
| DL-13 | This package's capture sent no adversarial request to the API apart from the one empty client seed of E06, so its data cannot reproduce a fairness-integrity test | The tests behind the S5 matrix were run separately on HouseBets' running service by ProvablyFair.org and are recorded in the ProvablyFair.org report for this game, Section 5 (Fairness Integrity Testing), not in this package: all 8 rows Pass on them (6 on every control the row names, 2 on part); single audit account | The [S5 matrix](#s5-fairness-integrity-matrix) names the tests behind each row and states what the captured data shows. Reproducing a test from this package needs a deliberate probe capture |
| DL-14 | The capture code ships as redacted reference copies, not as-run copies: comments edited, code unchanged ([Dataset and capture](#dataset-and-capture)). The $10 set's as-run rig is held privately (its sha256 is in that dataset's meta); the other as-run copies were not kept | The capture code shows how client seeds and targets were drawn; the exact bytes that ran for Phase A, C and D are not in the package (their sha256 is in each dataset's `meta.captureScript`) | No scored check reads the capture code; every bet is recomputed from the data |

## Terms

**G-BIND:** the framework's population rule (LIMBO-05): the counts a dataset is checked against are code constants in
`src/loader.ts`, never the dataset's own header.

## Release history

| Release | What changed | Verdict |
|---|---|---|
| `v1.0.0` | First public release, 24 Nov 2026. | PROVABLY FAIR — Full Pass |

Pilot run: the account's history (E05) also holds 500 limbo bets on the same engine, from a pilot run
of 12 Oct 2026; they are not part of the audited population ([Dataset and capture](#dataset-and-capture)).
