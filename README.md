# HouseBets Limbo — Provably Fair Audit (new engine, October 2026)

**Auditor:** [ProvablyFair.org](https://www.provablyfair.org) · **Audit ID:** PF-2026-HB06 · **Release:** `v1.0.0` (the first public release) · **Capture:** 12–13 October 2026

**Result: PROVABLY FAIR — Full Pass.** Of the 23 scored checks of the framework's LIMBO profile, 22 PASS and 1 is a
capture-origin FLAG, with 0 FAIL: LIMBO-15 (the capture sent no target above the game's client-side ceiling of
1,000,000×, so the profile's "targets on both sides of a client-side cap" is not covered). It is disclosed and
verdict-neutral. Every one of the 7,130 shipped bets recomputes exactly from its revealed server seed: result, win or
loss, multiplier and payout; the game page's own result function gives the served result on all 7,130 as well.
LIMBO-16 (wallet reconciliation) passes on the platform's bet history and the account reconciliation; the comparison of consecutive balances the profile describes was not possible in this capture, because other games were captured on the same account at the same time (MANIFEST.md DL-8).

**Theoretical RTP is 99 % (house edge 1 %) at every target from 1.01× to 1,000,000×, before the payout is truncated to 0.00000001**: the exact RTP of the 99,999,900
targets a player can enter, counted on the 2^32 draws of the published formula, runs from 99.0000000000 % to 99.0232771388 %, never below 99 % before that truncation (which depends on the stake and is not in these figures). Observed return over the 6,450
Phase A bets: 77.1558 % (49.78097455 paid on 64.52005950 staked), variance, not RTP evidence. Most of limbo's 99 % comes
from rare high-target wins, so a typical result of these same bets under the fair game is far below 99 %: in 100,000
fair replays of them (each bet keeps its target and stake and wins with its exact probability; `npm run fair-return`) the
median return is 61.88 %, the middle 80 % lie between 46.81 % and 118.66 %, and 73.3 % return at most the observed 77.16 %.

**Scope:** HouseBets House Games **Limbo** on the engine served since October 2026 (fairness version `canonical-v2`), the
USDT wallet. One audit account, in a logged-in browser session, captured through the game's own API calls: 6,450 Phase A
bets at the minimum stake plus a 30-bet tail, 250 bets at 100 × the minimum, 200 bets at $10 and 200 bets under four
client seeds typed by the auditor; targets from 1.01× to 1,000,000×. Not covered: a second account, server-side code, the
security of the platform and the other House Games (their own packages). Limitations:
[MANIFEST.md, Limitations and trust](MANIFEST.md#limitations-and-trust).

[Audit report](https://audit.provablyfair.org/casino/housebets/games/limbo/overview) · [Public repository](https://github.com/ProvablyFair-org/housebets-limbo) · [MIT license](LICENSE)

## What was verified

| Check | Captured evidence |
|---|---|
| Results | 7,130 / 7,130 recomputed from the revealed server seed (6,450 Phase A, 30 tail, 250 Phase C, 200 at $10, 200 Phase D), against HouseBets' published formula (E01) and compared with the server's own raw answer; the game page's own result function (E02), run on every bet's draw, agrees 7,130 / 7,130 |
| Win rule and payout | 7,130 / 7,130 settle by the rules on the game page (E02): a win when the result is at least the target, to the cent (ties witnessed and paid 10 / 10), payout stake × target truncated to 0.00000001 |
| Seeds and nonces | 143 / 143 revealed seeds hash to their commitments; the next-seed chain links from a pre-capture anchor; nonces 1..50 in every Phase A seed pair |
| Platform records | every bet in the platform's own bet history with the same stake and payout (E04); the account's full reconciliation (E05) |
| Draw bias | for every legal target the chance of winning is within 2^-32 of the published 99 ÷ target % |
| RTP claim | the 99 % stated in the rules (E02, E07) and the fairness answer (E01) holds on all 99,999,900 targets (RTP-CLAIM 1.2.0, LIMBO-19) |
| Simulation | 2,000,000 draws for uniformity; nine 1,000,000-bet targets from 1.01× to 10,000×, a 20,000,000-bet run at 2.00× and eight 2,000,000-bet targets from 1.10× to 1,000×, each on its own seeds; Pass 2 replays every one of the 143 revealed seeds over 10,000 nonces: no seed cherry-picking detected (z −0.180, p 0.4286) |

## Run the audit

Nothing to install: `node verify.js` runs on Node 22, `npm test` (the TypeScript sources) on Node 22.6 or later:

```
node verify.js          # the standalone verifier (generated from tests/verify.ts by npm run build:standalone)
npm test                # the same suite from the TypeScript sources, plus the RNG reference vectors
```

Expected, at the end of `node verify.js` (exit code 0):

```
scored checks (HARD_FAIL + FLAG): 22 PASS, 0 FAIL, 0 OVERSTATED, 0 operator FLAG, 1 capture FLAG, 0 NOT RUN of 23 expected (EXPECTED_STEPS: the profile's scored checks; ran 23); informational 1; package checks 7/7 PASS (no gaps)
VERDICT: PROVABLY FAIR — Full Pass
Reproduction vs the committed outputs/verification-results.json on Node 22.23.1: REPRODUCED
```

`verify` re-runs the whole simulation and counts the winning draws of every legal target rather than trusting the stored
results: 78 s measured on an Apple M2 Max (12 cores, Node 22.23.1) at load average 9 (`runtime` is the last
line it prints). `npm run mutate` runs the
falsifiability battery (each mutation must be caught by the check it names, measured against an unmutated control copy);
`npm run gate:fresh` (run it in a disposable copy of the package: a passing run rewrites the pinned record
`outputs/fresh-copy.json`, which names the Node version, so on another Node 22 patch the rewritten record no longer equals its pin) re-runs the package from a fresh copy and compares the regenerated artifacts with the committed ones.
Both write committed records (`outputs/mutation-results.json`, `outputs/fresh-copy.json`) that `npm run release-manifest`
pins. The verdict is withheld (INCOMPLETE, exit 3) if any of the profile's 23 scored checks has no status, or if
`src/profile-map.ts` does not match the framework's public profile shipped at `profile/profile.json` (1.0.4-public, sha256
`c5a7be5e09e5c94846e19e7c9b6619e358d005c5c0614bdacdc697e59abbb530`, pinned in the verifier). The release manifest records
the bun version that built `verify.js` (`toolchain.bun`). `node scripts/release-manifest.mjs --check` confirms every pinned
file (every file of the package except `RELEASE-MANIFEST.json` itself) and rebuilds `site-verifier/derive.js` with bun
1.3.9, comparing it with the shipped file byte for byte.

## Verdict and exit codes

`node verify.js` (and `npm run verify`) ends with one `VERDICT:` line and its exit code. Framework 1.1; RTP-CLAIM 1.2.0 is
switched on (Methodology v1.1). The codes and their order are the same in all 11 HouseBets new-engine packages:

| exit | verdict | when |
|---|---|---|
| 0 | PROVABLY FAIR — Full Pass | every scored check passes (a capture-origin FLAG is disclosed and does not move the verdict) |
| 2 | PROVABLY FAIR — Conditional Pass | an operator-origin FLAG, nothing worse |
| 5 | RTP FIGURE OVERSTATED | LIMBO-19: the published RTP figure (read from E01, E02 and E07) is missed on the house side by more than 0.1 pp; every other check passes, including the committed RTP table and record (a stale one is exit 1) |
| 3 | INCOMPLETE | a scored check of the profile has no status from this run, or the step list is not bound to the framework profile |
| 1 | NOT PROVABLY FAIR | a scored check fails; or a step throws (a file missing, a dataset field null or absent: the checks it scores print FAIL with the error, the other steps still run); or a release-gate record (`outputs/fresh-copy.json`, `outputs/mutation-results.json`) is missing or is not the bytes RELEASE-MANIFEST.json pins (its check prints FAIL) |
| 4 | (no verdict) | `verify.js` was not built from the sources beside it; rebuild with `npm run build:standalone` |

When more than one applies: NOT PROVABLY FAIR > INCOMPLETE > RTP FIGURE OVERSTATED > Conditional Pass > Full Pass.

## Verify a bet

1. **Save the commitment before you bet.** Copy the hashed server seed of your active seed pair and keep it with the time
   you saw it. It is the `hashedServerSeed` the game's API returns for the pair (`GET /housegames/seeds?gameType=limbo`);
   where the game's screen shows it was not captured for this audit. Your saved copy is what shows the seed was fixed
   before your bet: a hash read only afterwards can show consistency, not timing.
2. **Reveal the seed.** A bet can only be checked once its server seed is revealed, which happens when you rotate the seed
   pair: the server's answer to the rotation carries the previous server seed, and the game's verify tab fetches a
   rotated-away seed by its hash (`GET /housegames/unhash?hs=<hash>`; it refuses the active and the next seed). That is
   what the API and the game's code show; the rendered verify screen itself was not captured (MANIFEST.md DL-6).
3. **Collect the fields:** the revealed server seed, your client seed, and the bet's nonce (HouseBets nonces start at 1 on a
   fresh seed pair), plus your target and your stake.
4. **Check the commitment:** `sha256` of the server seed's text (UTF-8), as lowercase hex, must equal the hashed server seed
   you saved before betting.
5. **Recompute the result:** take `HMAC-SHA256(key = the server seed's 64-character text as UTF-8, message =
   "clientSeed:nonce:0")`, read its first 4 bytes as a big-endian 32-bit integer `u`, set `float = u / 2^32`, and the
   result is `floor(1e8 / (float × 1e8) × 0.99 × 100) / 100`, at least 1.00× and at most 1,000,000×. The key is the text,
   not the 32 bytes it hex-decodes to: HouseBets does not hex-decode the seed. Measured on
   this package's data: with a hex-decoded key 28 of the 7,130 shipped results match (25.4 expected by chance, since
   results near 1× recur often; all 28 are below 2.34×), with the text key 7,130 / 7,130; a hex-decoded commitment matches 0 of the 143 revealed seeds,
   the text 143 / 143.
6. **Apply the published rule** (E02): you win when the result is at least your target, compared to the cent (a result
   equal to the target wins); the payout is stake × target, truncated to 0.00000001.

The same six steps in code (`node` 22, nothing to install; save it as a `.cjs` file and run it with `node`), written from [docs/ALGORITHM.md](docs/ALGORITHM.md):

```javascript
const crypto = require('crypto');

// docs/ALGORITHM.md §1.2, §2, §3. The result is the published formula in binary64, as the game page evaluates it.
function verifyLimboBet({ serverSeed, clientSeed, nonce, target, stake }) {
  const key = Buffer.from(serverSeed, 'utf8');                  // the 64-character TEXT, not the 32 bytes it hex-decodes to
  const digest = crypto.createHmac('sha256', key).update(`${clientSeed}:${nonce}:0`, 'utf8').digest();
  const u = digest.readUInt32BE(0);                             // the draw, 0 … 2^32 − 1
  const q = 1e8 / (u / 2 ** 32 * 1e8) * (1 - 0.01);
  const result = Math.min(1e6, Math.max(Math.floor(q * 100) / 100, 1));   // 1.00× … 1,000,000×, on the 0.01× lattice
  const T = Math.round(Number(target) * 100);                   // the target in hundredths
  const win = Math.round(result * 100) >= T;                    // compared to the cent: a tie wins
  const stake8 = BigInt(Math.round(Number(stake) * 1e8));
  const pay8 = win ? (stake8 * BigInt(T)) / 100n : 0n;          // payout = stake × target, truncated to 1e-8
  const f8 = (v) => (v / 100000000n) + '.' + String(v % 100000000n).padStart(8, '0');
  return { commitment: crypto.createHash('sha256').update(serverSeed, 'utf8').digest('hex'),
    result: result.toFixed(2), win, payout: f8(pay8) };
}

// worked example: docs/ALGORITHM.md §5 V5, roundId e5c25ad5-ed2f-4949-971d-c0fa92c09a6a (Phase A)
console.log(verifyLimboBet({
  serverSeed: '15ac07a0cc9d7b4bccc5ff99d4a5fdc32450680d59f14c1eb872e387d8486b22',
  clientSeed: 'pflimbostartb95f196aab36b65ee8a4251bf0d77ff4', nonce: 13, target: 1.09, stake: 0.01000311,
}));
```

It prints `commitment: '36ad671054133f1c50b9fb5630ac0aeda2ae5cbbf7be0f19641995b27205ce00'`, `result: '1.62'`, `win: true`,
`payout: '0.01090338'`: the served commitment, result and payout of that bet. Run on the 7,130 shipped bets, the function
returns the served result, win flag, payout and commitment on all 7,130.

**ProvablyFair.org verifier:** check your bet at [provablyfair.org/verify-bets/housebets](https://www.provablyfair.org/verify-bets/housebets); the
page runs `site-verifier/derive.js` from this release (sha256 `a375ed511eec67360ea34b21c22ee2a4742267c46c6b83263135e65d3cd9577a`).
LIMBO-24 runs that file side by side with `src/rng.ts` on every captured bet
([MANIFEST.md, Player verifiers](MANIFEST.md#player-verifiers)). The steps and the function above check a bet by hand,
without the page; `src/rng.ts` and `src/rules.ts` are the same steps in the package's own code.

## Files and evidence

There are two documentation files: this README and [MANIFEST.md](MANIFEST.md), the consolidated audit overview (dataset,
algorithm, payouts and RTP, results, the S5 matrix, reproduction, evidence, limitations and release history). The algorithm
specification is [docs/ALGORITHM.md](docs/ALGORITHM.md); the module interface [docs/INTERFACE.md](docs/INTERFACE.md).

| Dataset | SHA-256 |
|---|---|
| [data/housebets-limbo-phaseA-6450bets.json](data/housebets-limbo-phaseA-6450bets.json) (Phase A, primary) | `b18a02b7e1334d1f86c84248b5e25892b6e022f89804c1694ebe8ebb0afd803f` |
| [data/housebets-limbo-phaseA-tail-30bets.json](data/housebets-limbo-phaseA-tail-30bets.json) | `50426eab9268df584394d62d564dfe095f34ec916227df40754e01cde121dd75` |
| [data/captured/housebets-limbo-sp1-6480bets.redacted.json](data/captured/housebets-limbo-sp1-6480bets.redacted.json) (the capture both files above are split from) | `88acb2f0213655a9aa33dd96c789b9ad3b16bc5cec9f87352a302badf0ff0a4d` |
| [data/supplementary/housebets-limbo-phaseC-250bets.json](data/supplementary/housebets-limbo-phaseC-250bets.json) | `b7a2278d0f1628faf2afed638e795dc4768c3af01a8c996b4c15f41261450582` |
| [data/supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json](data/supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json) | `8c079aff19ed7932089096b9e4b907482104057020aa9c399945dc2757b15a8d` |
| [data/supplementary/housebets-limbo-phaseD-200bets.json](data/supplementary/housebets-limbo-phaseD-200bets.json) | `8b0559985f2f7259bb7348afaecbff3300111ee6bd5e3d58df8a84b5a98e594e` |

`data/SHA256SUMS` lists the same (`shasum -a 256 -c SHA256SUMS` in `data/`). `evidence/` holds E01–E07, `capture/` the
reference copies of the capture code (MANIFEST.md#dataset-and-capture), `profile/` the framework's public LIMBO profile
1.0.4-public, byte for byte, `outputs/` the pinned simulation census, RTP table and verification record and the committed mutation and fresh-copy
records, `src/` the derivation, `tests/verify.ts` the 31 checks of the LIMBO profile, `scripts/` the split, mutation
battery, fresh-copy gate, standalone build, site-verifier build, release manifest, the recompute of excluded captures, the
fair-return replay, the user-id redaction and the evidence builders, `site-verifier/derive.js` the ProvablyFair.org
verifier module for this game, generated from `src/rng.ts`.

The release commit and tag are signed with the ProvablyFair.org release key (SSH,
`SHA256:gEujiJm2pRyq7lQsfYQfQ1r97H/J7GdaKHbOW8GtikY`), which the release manifest records.
