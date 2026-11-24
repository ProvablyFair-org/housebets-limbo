// Win rule, multiplier and payout of HouseBets limbo (new engine), in exact integer units.
//   win        result ≥ target, compared to the cent (E01 "result >= target"; E02 isWin: round(result·100) ≥ round(target·100))
//   multiplier the chosen target on a win, 0 on a loss (E02 rulesWinWhen "The payout is your stake × target")
//   payout     floor(stake × target) at 1e-8 (measured on every single-request round, 12 Oct 2026; E02 says stake × target)
// Targets and results carry 2 decimals; they are converted to hundredths with Math.round, never compared as floats.

export const hund = (x: number): number => Math.round(x * 100);

export const wins = (targetH: number, resultH: number): boolean => resultH >= targetH;

/** The decimal digits of a value exactly as JSON gave it: a number through its shortest round-trip string (String(x)),
 *  exponent forms expanded without rounding; a string as written. Never toFixed, which rounds. */
export function decimalText(x: number | string): string {
  let s = typeof x === 'number' ? String(x) : String(x).trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(s);
  if (m) {
    const [, sign, ip, fp = '', ex] = m; const digits = ip + fp; let point = ip.length + Number(ex);
    if (point <= 0) s = `${sign}0.${'0'.repeat(-point)}${digits}`;
    else if (point >= digits.length) s = `${sign}${digits}${'0'.repeat(point - digits.length)}`;
    else s = `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new Error(`not a decimal: ${s}`);
  return s;
}
/** Decimal places carrying a non-zero digit (trailing zeros do not count). */
export const decimals = (x: number | string): number => { const f = (decimalText(x).split('.')[1] || '').replace(/0+$/, ''); return f.length; };
/** money on the platform's 1e-8 grid (at most 8 decimals), checked on the value as given, before any rounding. */
export const onGrid8 = (x: unknown): boolean => (typeof x === 'number' || typeof x === 'string') && decimals(x) <= 8;
/** a result on the published 0.01 lattice (at most 2 decimals), checked on the value as given, before any rounding. */
export const onLattice2 = (x: unknown): boolean => (typeof x === 'number' || typeof x === 'string') && decimals(x) <= 2;

/** A decimal number (as JSON gave it) to integer 1e-8 units. Throws on a value off the 1e-8 grid: callers that compare data
 *  check onGrid8 first, so an off-grid value is a FAIL of the check that reads it, never a silent rounding. */
export function units8(x: number | string): bigint {
  const s = decimalText(x);
  const [i, f = ''] = s.replace('-', '').split('.');
  if (f.length > 8 && /[1-9]/.test(f.slice(8))) throw new Error(`more than 8 decimals: ${s}`);
  const v = BigInt(i) * 100000000n + BigInt((f + '00000000').slice(0, 8));
  return s.startsWith('-') ? -v : v;
}
/** units8 for data: null when the value is off the 1e-8 grid or not a number (a comparison against null is false). */
export const u8 = (x: unknown): bigint | null => (onGrid8(x) ? units8(x as number | string) : null);

/** The multiplier paid on a win at target T, in hundredths: the target itself (E02 "The payout is your stake × target").
 *  The one place the payout rule is written: the payout recompute (multiplier8) and the exact RTP of every legal target
 *  (src/rtp-settings.ts, LIMBO-19) both read it. */
export const multiplierH = (targetH: number): number => targetH;

/** The multiplier of a target in 1e-8 units (target T hundredths → T × 10^6). */
export const multiplier8 = (targetH: number): bigint => BigInt(multiplierH(targetH)) * 1000000n;

/** floor(stake × multiplier) at 1e-8, both in 1e-8 units. */
export const payout8 = (stake8: bigint, mult8: bigint): bigint => (stake8 * mult8) / 100000000n;
