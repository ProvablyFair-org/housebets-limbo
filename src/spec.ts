// The game as HouseBets publishes it — the only source of every declared number this package holds the data to.
//   E01  GET /housegames/limbo/fairness, answered to the capture 12 Oct 2026 17:04:46Z (RNG, formula, range, win rule,
//        4 worked examples with their draws)
//   E02  the limbo game page's rules panel and the constants it is filled from, in the bundle the live page loads
//        (bundles/platform-housegames-limbo-game.js, checked on the live page 10 Oct 2026)
//   E03  GET /housegames/limits/limbo (min/max bet, max win, wallet decimals)
// Nothing here is read from the captured bets. A number that is not in E01-E03 is not declared. These are hand copies kept for
// the hot paths; src/exhibits.ts compares every one of them with the value parsed from its pinned exhibit at verify time, and
// a difference fails LIMBO-26.

/** E01 "scale": 100, "rounding": "floor", "min": 1, "max": 1000000 — results in hundredths (1.00× … 1,000,000.00×). */
export const SCALE = 100;
export const MIN_RESULT_H = 100;
export const MAX_RESULT_H = 100_000_000;

/** E01 "houseEdge": 0.01; E02 HOUSE_EDGE gc = .01 and NUMERATOR $s = 425201762304 (= 99 × 2^32). */
export const HOUSE_EDGE = 0.01;
export const TWO32 = 4294967296;
export const NUMERATOR = 425201762304;

/** E02 constants: bc = 1.01 (minimum target), eo = 1e6 (maximum target = result cap), Xs = 2 (default target). Targets
 *  carry 2 decimals (E02 clampTarget fa = round to 2 decimals within [bc, eo]). In hundredths: */
export const MIN_TARGET_H = 101;
export const MAX_TARGET_H = 100_000_000;
export const DEFAULT_TARGET_H = 200;

/** E01 "winRule": "result >= target"; E02 rulesWinWhen "You win when the result is at least your target (compared to the
 *  cent). The payout is your stake × target." */
export const WIN_RULE_TEXT = 'You win when the result is at least your target (compared to the cent). The payout is your stake × target.';

// The RTP claim is NOT held here: src/exhibits.ts reads it at verify time from every place
// the evidence states it (E02 and E07 rulesRtpLine, E01 houseEdge and summary) and hands it to the RTP-CLAIM rule (LIMBO-19).

/** E02 rulesMaxWin "A round pays at most {cap}. A bet whose win would exceed the cap is refused — not reduced"; E03 wallet
 *  maxWin 1000310.0961298 USDT. E03 wallet.minBet: the platform minimum stake (USDT), the Phase A stake. */
export const MAX_WIN = '1000310.0961298';
export const MIN_STAKE = '0.01000311';
export const WALLET_DECIMALS = 8;

/** E01 formula, verbatim: "The result is floor(1e8 / (float x 1e8) x 0.99 x 100) / 100, at least 1.00x and at most
 *  1000000x, and a bet wins when result >= target." with float = u / 2^32, u the first 4 bytes of block 0 big-endian. */
export const FORMULA_TEXT = 'floor(1e8 / (float x 1e8) x 0.99 x 100) / 100, at least 1.00x and at most 1000000x';

/** E01 vectors (the published worked examples, with the draw u each one reads). */
export const SPEC_VECTORS = [
  { serverSeed: 'housebets-demo-server-seed-0001', clientSeed: 'demo-client', nonce: 1, draw: 3067352357, resultH: 138 },
  { serverSeed: 'housebets-demo-server-seed-0001', clientSeed: 'demo-client', nonce: 2, draw: 3513789633, resultH: 121 },
  { serverSeed: 'housebets-demo-server-seed-0001', clientSeed: 'demo-client', nonce: 3, draw: 3992373399, resultH: 106 },
  { serverSeed: '5a1f7d2c9e4b8a3f6d0c2b5e8f1a4d7c0b3e6f9a2d5c8b1e4f7a0d3c6b9e2f5a', clientSeed: 'housebets', nonce: 1, draw: 2685149531, resultH: 158 },
] as const;

/** The commitment encoding: the capture's commitments are sha256 of the server seed's UTF-8 text (LIMBO-01). */
export const COMMITMENT_ENCODING = 'sha256(utf8(serverSeed)) as lowercase hex';
