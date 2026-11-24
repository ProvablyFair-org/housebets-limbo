// HouseBets House Games limbo, new engine ("canonical-v2"), derived from the published spec only (E01, GET
// /housegames/limbo/fairness; clean-room check capture-2026-10-12/check_specs.py).
//   digest = HMAC-SHA256(key = serverSeed as UTF-8, message = `${clientSeed}:${nonce}:${block}`), block 0
//   u      = big-endian uint32 of digest[0..3];  float = u / 2^32
//   result = floor(1e8 / (float × 1e8) × 0.99 × 100) / 100, at least 1.00× and at most 1,000,000×
// resultFromU is that formula as published and as the game page's own code evaluates it (E02, resultFromUint32V2), in
// binary64: it is the DECLARED derivation. resultExactH is the same formula in exact rational arithmetic,
// floor(99 · 2^32 / u); the two are compared on every captured bet (LIMBO-07) and on the whole draw domain (LIMBO-08).
import { createHmac, createHash } from 'node:crypto';
import { NUMERATOR, TWO32, MIN_RESULT_H, MAX_RESULT_H, HOUSE_EDGE } from './spec.ts';

export function hmacBlock(serverSeed: string, clientSeed: string, nonce: number, block: number): Buffer {
  return createHmac('sha256', Buffer.from(serverSeed, 'utf8')).update(`${clientSeed}:${nonce}:${block}`).digest();
}

/** The draw u of a bet: the first 4 bytes of block 0, big-endian. */
export const drawU = (serverSeed: string, clientSeed: string, nonce: number): number => hmacBlock(serverSeed, clientSeed, nonce, 0).readUInt32BE(0);

/** The published formula in binary64, exactly as E02's resultFromUint32V2 writes it (u = 0 gives 1e8/0 = Infinity, clamped
 *  to the cap). Returns the result in hundredths. */
export function resultFromU(u: number): number {
  const q = 1e8 / (Math.floor(u) / TWO32 * 1e8) * (1 - HOUSE_EDGE);
  const r = Math.max(Math.floor(q * 100) / 100, 1);
  return Math.round(Math.min(1e6, r) * 100);
}

/** The same formula in exact rational arithmetic: floor(99 · 2^32 / u) hundredths, clamped to [1.00, 1,000,000.00]. */
export function resultExactH(u: number): number {
  if (u === 0) return MAX_RESULT_H;
  let q = Math.floor(NUMERATOR / u);
  if (q * u > NUMERATOR) q--; else if ((q + 1) * u <= NUMERATOR) q++;   // exact integer floor (all terms < 2^53)
  return Math.min(MAX_RESULT_H, Math.max(MIN_RESULT_H, q));
}

/** The result in hundredths of a bet (declared formula). */
export const resultHundredths = (serverSeed: string, clientSeed: string, nonce: number): number => resultFromU(drawU(serverSeed, clientSeed, nonce));

/** floor(NUMERATOR / T) as an exact integer. */
export function boundaryDraw(T: number): number {
  let q = Math.floor(NUMERATOR / T);
  if (q * T > NUMERATOR) q--; else if ((q + 1) * T <= NUMERATOR) q++;
  return q;
}

/**
 * The number of draws u in [0, 2^32) that win at target T (hundredths) under the declared formula. resultFromU is
 * non-increasing in u (every operation is monotone and binary64 rounding preserves order), so the winning draws are
 * 0 … w−1 for one w. The exact-rational boundary is b = floor(99·2^32 / T) (u ≤ b ⟺ 99·2^32/u ≥ T); the declared count is
 * read at b and b+1 and the monotone step is checked there, so the count is exact without enumerating 2^32 draws.
 * `ok` false means the declared formula is not monotone at the boundary (the count would then be unproven).
 */
export function winningDraws(T: number): { count: number; exact: number; ok: boolean } {
  const b = boundaryDraw(T);
  const exact = Math.min(TWO32, b + 1);
  const atB = b < TWO32 ? resultFromU(b) >= T : true;
  const after = b + 1 < TWO32 ? resultFromU(b + 1) < T : true;
  if (atB && after) return { count: exact, exact, ok: true };
  if (!atB && after && (b === 0 || resultFromU(b - 1) >= T)) return { count: b, exact, ok: true };
  return { count: exact, exact, ok: false };
}

export const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
