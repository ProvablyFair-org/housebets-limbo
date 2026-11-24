# HouseBets Limbo: algorithm specification

Written 21 Oct 2026 for the ProvablyFair.org audit of HouseBets House Games **Limbo** on the October 2026 engine
(fairness version `canonical-v2`).

This document states the outcome derivation and the settlement of HouseBets Limbo in enough detail to rebuild them. It is
taken from what HouseBets publishes and from this package's own code, and every rule names its source:

- **SPEC**: HouseBets' published fairness answer, `GET /housegames/limbo/fairness`, as answered to the capture on
  12 Oct 2026 17:04:46Z (exhibit E01, `evidence/E01-limbo-fairness-spec-2026-10-12.json`).
- **PAGE**: the rules panel text, constants and functions in the limbo game page's code (E02, the bundle of 10 Oct 2026;
  E07, the live copy fetched 19 Oct 2026). The rendered panel was not captured.
- **LIMITS**: `GET /housegames/limits/limbo` (E03): minimum stake 0.01000311 USDT, wallet decimals 8.
- **DATA**: measured on the captured bets by the scored steps of `tests/verify.ts` (step ids `LIMBO-nn`; the counts are
  the ones `npm test` prints).
- **CODE**: the module of this package that implements the rule (`src/rng.ts`, `src/rules.ts`, `src/spec.ts`).

---

## 1. Inputs and commitment

### 1.1 Inputs

| Input | Form | Source |
|---|---|---|
| `serverSeed` | 64 lowercase hex characters; secret until the pair is rotated | DATA: 143/143 revealed seeds of the shipped files. The derivation uses it as **text** (§2) |
| `clientSeed` | text string | SPEC (`message`); DATA: `pflimbo` + 32 hex characters in Phases A–C (`pflimbostart` + 32 hex on the first pair of a set), four auditor-typed seeds in Phase D (`provablyfair-1`, `provablyfair-2`, `player-seed-abc`, `1234567890`); all ASCII |
| `nonce` | integer, **1** on the first bet of a fresh pair, +1 per bet | DATA: nonces exactly 1…50 in 129/129 Phase A epochs, equal to the server's nonce count at rotation (LIMBO-04) |
| `target` | multiplier with 2 decimals, 1.01 … 1,000,000 | PAGE (E02 `MIN_TARGET` 1.01, `MAX_TARGET = RESULT_CAP` 1e6, `clampTarget`) |
| `stake` | USDT, at most 8 decimals | LIMITS (decimals 8); DATA |

Work in **hundredths**: the target `T` and the result `R` are the integers `round(x × 100)` (CODE: `src/rules.ts` `hund`).

### 1.2 Commitment

```
commitment = lowercase_hex( SHA-256( UTF-8(serverSeed) ) )
```

- SOURCE: SPEC (summary: "The server seed is committed up front by its SHA-256 hash and revealed when you rotate") +
  DATA for the encoding: 143/143 revealed seeds across Phase A, its tail, C, the $10 set and D (LIMBO-01).
- The next-seed hash chain links on 128/128 Phase A transitions, from a pre-capture anchor (LIMBO-02).
- CODE: `src/rng.ts` `sha256Hex`.

---

## 2. Outcome derivation

### Step 1: HMAC and draw

```
key     = UTF-8(serverSeed)                                     # the 64-character text, not hex-decoded
message = UTF-8( clientSeed + ":" + decimal(nonce) + ":" + "0" )
digest  = HMAC-SHA256(key, message)
u       = digest[0..3] read as an unsigned 32-bit BIG-ENDIAN integer      # 0 … 2^32 − 1
float   = u / 2^32
```

- SOURCE: SPEC (`"hash": "HMAC-SHA256"`, `"key": "serverSeed"`, `"message": "clientSeed:nonce:block"`,
  `"bytesPerDraw": 4`, `"byteOrder": "big-endian"`, `"drawBits": 32`; summary: "limbo reads one draw at cursor 0, so its
  block is 0").
- `u` is a full 32-bit value: no range reduction, no rejection (LIMBO-08).
- CODE: `src/rng.ts` `hmacBlock`, `drawU`.

### Step 2: draw to result

The published formula, evaluated in binary64 exactly as the game page's code does it (E02 `resultFromUint32V2`):

```
q      = 1e8 / (u / 2^32 × 1e8) × (1 − 0.01)            # u = 0 gives Infinity
R      = max( floor(q × 100) / 100 , 1 )
result = min( 1e6 , R )                                   # 1.00× … 1,000,000×, on the 0.01× lattice
```

The same formula in exact rational arithmetic, in hundredths:

```
result_h = clamp( floor( 99 × 2^32 / u ) , 100 , 100000000 )      # u = 0 → 100000000
```

- SOURCE: SPEC, verbatim: "The result is floor(1e8 / (float x 1e8) x 0.99 x 100) / 100, at least 1.00x and at most
  1000000x" (`houseEdge` 0.01, `scale` 100, `rounding` `floor`, `min` 1, `max` 1000000). PAGE holds the same constants:
  `HOUSE_EDGE` 0.01, `NUMERATOR` 425201762304 (= 99 × 2^32), `RESULT_CAP` 1e6.
- DATA: the binary64 formula equals the served result on 6,450/6,450 Phase A bets and 680/680 tail and supplementary
  bets, compared exactly on the 0.01× lattice; the exact rational form gives the same result on all 7,130 (LIMBO-07).
- The two forms differ only at 40 targets, each on the single draw `u = 99 × 2^32 / T`, which the float formula scores as
  `T − 0.01` where exact arithmetic gives `T` (LIMBO-08; §6 O3). The package follows the published float formula.
- SPEC vectors: the four worked examples E01 publishes, with their draws, recompute 4/4 (LIMBO-09; §5 V1–V4).
- CODE: `src/rng.ts` `resultFromU` (binary64, the declared derivation), `resultExactH` (exact).

---

## 3. Win condition and payout

### 3.1 Win condition

```
win  ⟺  result_h ≥ T            # compared to the cent; a tie wins
```

- SOURCE: SPEC (`"winRule": "result >= target"`) + PAGE, verbatim (E02 rulesWinWhen): "You win when the result is at
  least your target (compared to the cent). The payout is your stake × target." E02 `isWin`:
  `Math.round(result × 100) >= Math.round(target × 100)`.
- DATA: the win flag recomputed from the result, never the served flag, on 6,450/6,450 Phase A bets (LIMBO-10). Ties
  (result = target) witnessed and paid 10/10; results on the 1.00× floor witnessed and lost 121/121; no result reached
  the cap (LIMBO-17; §6 O1).
- CODE: `src/rules.ts` `wins`.

### 3.2 Win probability

The result does not rise as `u` rises, so a target `T` wins on the draws `0 … w − 1` for one count `w`:

```
b = floor( 99 × 2^32 / T )                       # u ≤ b  ⟺  99 × 2^32 / u ≥ T
w = min( 2^32 , b + 1 )                          # exact form; the float form is checked at b and b + 1
P(win) = w / 2^32                                # within 2^-32 of 99 / T
```

- SOURCE: PAGE (E02 rulesChanceFormula: "Win chance = 99 ÷ target, in percent.") + SPEC summary ("A target t is reached
  with probability 0.99 / t").
- DATA: for every one of the 99,999,900 legal targets the winning draws are counted at the monotone step around `b`
  (0 non-monotone steps); the worst |P(win) − 99 / T| is exactly 2^-32, at 78 targets, every one a divisor of
  99 × 2^32 (LIMBO-08). For each of the 4,425 distinct served targets a bisection over all 2^32 draws gives the same count
  (LIMBO-18). The server's own `winChance` field is compared, never used (LIMBO-13).
- CODE: `src/rng.ts` `boundaryDraw`, `winningDraws`.

### 3.3 Multiplier

```
multiplier = T / 100          on a win          # the chosen target itself
multiplier = 0                on a loss
```

- SOURCE: PAGE (E02 rulesWinWhen "The payout is your stake × target"). The house edge sits in the result formula's 0.99,
  not in the payout.
- DATA: the multiplier paid on a win equals the target on 922/922 Phase A winners and 345/345 tail and supplementary
  winners; losers are served 0 on 5,528/5,528 (LIMBO-13).
- CODE: `src/rules.ts` `multiplierH`, `multiplier8` (`T × 10^6` in 1e-8 units).

### 3.4 Payout

```
payout = floor_8( stake × target )      on a win          # truncated to the wallet's 1e-8 unit
payout = 0                               on a loss
```

In 1e-8 units: `payout8 = floor(stake8 × mult8 / 10^8)`.

- SOURCE: PAGE (stake × target) + LIMITS (wallet decimals 8). The truncation is DATA: exact at 8 decimals on 6,450/6,450
  Phase A bets and 680/680 tail and supplementary bets, every money value on the 1e-8 grid as served (LIMBO-11, LIMBO-12).
- Max win: E02 rulesMaxWin "A round pays at most {cap}. A bet whose win would exceed the cap is refused — not reduced";
  E03 `wallet.maxWin` 1,000,310.0961298 USDT. No bet came near it (largest captured payout 19.30850307 USDT; LIMBO-14 passes with the refusal declared unwitnessed; §6 O2).
- No scaling edge: the spec carries one flat `houseEdge`; every winner at the three captured stakes (0.01000311,
  1.000311, 10) was paid exactly its target, 1,267/1,267 (LIMBO-31).
- CODE: `src/rules.ts` `units8`, `payout8`.

### 3.5 RTP

The exact return of target `T`, before the payout is truncated to 1e-8 (§3.4), is `w(T) × (T / 100) / 2^32`. Across all 99,999,900 legal targets it runs from
0.990000000000 (target 1.32) to 0.990232771388 (target 999769.01), never below 99 % before that truncation (LIMBO-19,
`outputs/rtp-claim-table.json`). The published figure is 99 % (E02 rulesRtpLine "RTP is 99% at every target; the house
edge is 1%."; E07, the live bundle, "Theoretical RTP before payout rounding: 99% (1% house edge)."; E01 `houseEdge` 0.01
and its summary), read by the verifier from the exhibits at run time.

### 3.6 Fields an implementation must not read

The served `outcome`, `payoutMultiplier`, `payout`, `winChance` and the wallet balance are claims to be checked. The
derivation reads only the revealed `serverSeed`, `clientSeed`, `nonce`, the `target` and the `stake`.

---

## 4. Source per step (summary)

| Step | Source | Evidence |
|---|---|---|
| Commitment = SHA-256 over the seed's UTF-8 text | SPEC + DATA | 143/143 seeds (LIMBO-01) |
| Next-seed hash chain | DATA | 128/128 Phase A links (LIMBO-02) |
| Nonce from 1, +1 per bet | DATA | 129/129 epochs (LIMBO-04) |
| HMAC-SHA256, key = seed text, message `clientSeed:nonce:0`, first 4 bytes big-endian | SPEC | 6,450/6,450 + 680/680 results (LIMBO-07); E01 vectors 4/4 (LIMBO-09) |
| Result formula, binary64, floor to 0.01×, clamp [1, 1e6] | SPEC + PAGE | 6,450/6,450 + 680/680 (LIMBO-07); exact form agrees 7,130/7,130 |
| Win = result ≥ target, to the cent | SPEC + PAGE | 6,450/6,450 (LIMBO-10); ties 10/10 paid, floor 121/121 lost (LIMBO-17) |
| P(win) within 2^-32 of 99 / T | PAGE + SPEC | every legal target (LIMBO-08); 4,425/4,425 served targets by bisection (LIMBO-18) |
| Multiplier = target on a win, 0 on a loss | PAGE | 922/922 + 345/345 winners; 5,528/5,528 losers (LIMBO-13) |
| Payout truncated to 1e-8 | PAGE + LIMITS + DATA | 6,450/6,450 + 680/680 (LIMBO-11, LIMBO-12) |

---

## 5. Test vectors

V1–V4 are E01's published worked examples (E01 also publishes their draws). V5–V9 are copied from
`data/housebets-limbo-phaseA-6450bets.json` (bet `roundId`), with the server seed found by its hash (§1.2). Every value
below was printed by this package's `src/rng.ts` and `src/rules.ts` and equals the served value.

**V1–V4: E01 examples**
```
housebets-demo-server-seed-0001 / demo-client / nonce 1 → u 3067352357 → result 1.38 (E01: draw 3067352357, result 1.38)
housebets-demo-server-seed-0001 / demo-client / nonce 2 → u 3513789633 → result 1.21 (E01: 3513789633, 1.21)
housebets-demo-server-seed-0001 / demo-client / nonce 3 → u 3992373399 → result 1.06 (E01: 3992373399, 1.06)
5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a / housebets / nonce 1 → u 2685149531 → result 1.58 (E01: 2685149531, 1.58)
```

**V5: roundId `e5c25ad5-ed2f-4949-971d-c0fa92c09a6a`** (target 1.09, win)
```
serverSeed  15ac07a0cc9d7b4bccc5ff99d4a5fdc32450680d59f14c1eb872e387d8486b22
commitment  36ad671054133f1c50b9fb5630ac0aeda2ae5cbbf7be0f19641995b27205ce00
message     pflimbostartb95f196aab36b65ee8a4251bf0d77ff4:13:0      stake 0.01000311
HMAC        9bfc5140e7e6d657578ce2608f92f26a0607c89387a52498fa222a278fd741c0
u 2617004352 → result 1.62 ≥ 1.09 → win; multiplier 1.09 → payout 0.01090338
```

**V6: roundId `cab2c67f-60e1-4acb-9ad0-868fc9ab1573`** (target 19.81, win)
```
serverSeed  15ac07a0cc9d7b4bccc5ff99d4a5fdc32450680d59f14c1eb872e387d8486b22
message     pflimbostartb95f196aab36b65ee8a4251bf0d77ff4:42:0      stake 0.01000311
HMAC        09d8fa82a751b044a75f47484a89cfec1da58b80f1c665191e38b20f12a591a0
u 165214850 → result 25.73 ≥ 19.81 → win; multiplier 19.81 → payout 0.19816160 (served 0.1981616)
```

**V7: roundId `e833e523-c07a-455f-be11-9126df380a64`** (target 1.50, result on the target: a tie wins)
```
serverSeed  442d44a2f93daab2412700353acc01e68633b174f65888e51e9991f369d51b3b
commitment  3c6adf5e37316d594e6b4de2f90730ce89d15492e4203179d91f4743fcae8294
message     pflimbo423da695d95105cd7840c55afb26ba69:36:0      stake 0.01000311
HMAC        a831a6382ef2a6044be6bd6b9c59e435fab78f36fd03540ca7c5bf1ebfe9d8b8
u 2821826104 → result 1.50 ≥ 1.50 → win; multiplier 1.5 → payout 0.01500466
```

**V8: roundId `d51a7613-39af-402f-92c5-b5e0556714e3`** (target 1.01, result on the 1.00× floor)
```
serverSeed  152d05661cb434ac02f3091569cf60bfefc16de3114dc997e5dcbb9e710ab226
commitment  b28ee061bb3010d95527e0ffff7877360bebc15eb41e5c6818f6db7d43e721f3
message     pflimbobad8d7f1be39fcdf2c9e28f0c457e70f:2:0      stake 0.01000311
HMAC        fd840501bcc39d286888475417f229f65b369bc7fe8421c315c553f5949a2ca0
u 4253287681 → result 1.00 < 1.01 → loss; multiplier 0, payout 0
```

**V9: roundId `2f26c472-77fd-4494-83c7-a52bd0c81b20`** (target 22446.19, loss)
```
serverSeed  15ac07a0cc9d7b4bccc5ff99d4a5fdc32450680d59f14c1eb872e387d8486b22
message     pflimbostartb95f196aab36b65ee8a4251bf0d77ff4:1:0      stake 0.01000311
HMAC        83c80267947283114852a9ce760d3b94c8f2f8708b7482f4b41cb2cb894a33d1
u 2210923111 → result 1.92 < 22446.19 → loss; multiplier 0, payout 0
```

At target 2.00 the boundary draw is `b = floor(99 × 2^32 / 200)` = 2126008811, so 2,126,008,812 draws win
(`src/rng.ts` `winningDraws(200)`).

---

## 6. Open points the public sources do not settle

- **O1: cap not witnessed.** No result reached 1,000,000× (a draw does so with probability 4,253 / 2^32); the cap is
  taken from E01, E02 and the formula (MANIFEST.md DL-3).
- **O2: max-win refusal and server-side target ceiling.** The refusal is reachable within the bet limits and was never
  produced; targets above 1,000,000× are blocked in the game's code (E02 `clampTarget`) and were never sent, so whether
  the server also refuses them is not known (DL-10).
- **O3: float versus exact.** At 40 targets the published binary64 formula and exact arithmetic differ on one draw
  (probability 2^-32); the package follows the published formula, and at those targets P(win) is exactly 99 / T (DL-4).
- **O4: payout truncation.** E02 says "stake × target"; the truncation to 1e-8 is measured on every bet, not published.
- **O5: reveal path.** Observed in the API and the game's code, not on the rendered verify screen (DL-6).
- **O6: client-seed encoding beyond ASCII.** UTF-8 is applied by `src/rng.ts`; every captured client seed is ASCII.
- **O7: stake grid and currency.** Only USDT was captured, at 0.01000311, 1.000311 and 10.

---

## 7. Reproduction

`npm test` (or `node verify.js`) recomputes every rule above on every shipped bet and prints the counts this document
cites; the step ids are in §4. `tests/rng.test.ts` holds the E01 vectors (V1–V4). V5–V9 and the target-2.00 boundary
were printed by calling `src/rng.ts` `hmacBlock`, `drawU`, `resultFromU`, `resultExactH`, `boundaryDraw`, `winningDraws`
and `src/rules.ts` `wins`, `multiplier8` and `payout8` on those bets of the Phase A file.

---

## 8. Sources in this package

`evidence/E01-limbo-fairness-spec-2026-10-12.json`, `evidence/E02-limbo-rules-panel-2026-10-10.json`,
`evidence/E03-limbo-limits-2026-10-12.json`, `evidence/E07-limbo-rules-panel-live-2026-10-19.json`;
`data/housebets-limbo-phaseA-6450bets.json`; `src/rng.ts`, `src/rules.ts`, `src/spec.ts`;
`outputs/rtp-claim-table.json`; the step output of `npm test`.
