# Module interface of the derivation (written by the auditor, not from the casino)

`src/rng.ts` and `src/rules.ts` are the derivation of [ALGORITHM.md](ALGORITHM.md) in code (TypeScript, strict, Node
`crypto` only, no dependencies). The names below are what the verifier (`tests/verify.ts`), the simulation
(`src/simulate.ts`) and the RTP table (`src/rtp-settings.ts`) import from them. Semantics come from ALGORITHM.md; this file
fixes names, types and the package's conventions: targets and results in **hundredths** (integers, 1.00× = 100), money
in **1e-8 units** (`bigint`).

```ts
// src/rng.ts
// HMAC-SHA256(key = UTF-8(serverSeed), message = `${clientSeed}:${nonce}:${block}`), 32 bytes. Limbo uses block 0.
export function hmacBlock(serverSeed: string, clientSeed: string, nonce: number, block: number): Buffer;
// The draw u: the first 4 bytes of block 0, big-endian, 0..2^32 − 1.
export const drawU: (serverSeed: string, clientSeed: string, nonce: number) => number;
// The published formula in binary64, as the game page's resultFromUint32V2 evaluates it; the result in hundredths,
// 100..100000000 (u = 0 gives the cap). This is the declared derivation.
export function resultFromU(u: number): number;
// The same formula in exact integer arithmetic: floor(99 · 2^32 / u), clamped to 100..100000000.
export function resultExactH(u: number): number;
// resultFromU(drawU(...)).
export const resultHundredths: (serverSeed: string, clientSeed: string, nonce: number) => number;
// floor(99 · 2^32 / T) as an exact integer: the last winning draw of target T under exact arithmetic.
export function boundaryDraw(T: number): number;
// The number of draws in [0, 2^32) that win at target T under the declared formula; `exact` is the exact-arithmetic
// count, `ok` false would mean the declared formula is not monotone at the boundary.
export function winningDraws(T: number): { count: number; exact: number; ok: boolean };
// The commitment: SHA-256 of the seed's UTF-8 text, lowercase hex.
export const sha256Hex: (s: string) => string;

// src/rules.ts
// A target or result (2 decimals) to hundredths: Math.round(x × 100).
export const hund: (x: number) => number;
// resultH ≥ targetH (a tie wins).
export const wins: (targetH: number, resultH: number) => boolean;
// The multiplier paid on a win at target T, in hundredths: T itself.
export const multiplierH: (targetH: number) => number;
// multiplierH in 1e-8 units: T × 10^6.
export const multiplier8: (targetH: number) => bigint;
// A decimal as JSON gave it to 1e-8 units; throws on a value with a non-zero digit past the eighth decimal.
export function units8(x: number | string): bigint;
// floor(stake8 × mult8 / 10^8): the payout in 1e-8 units.
export const payout8: (stake8: bigint, mult8: bigint) => bigint;
```

`src/rules.ts` also exports the grid helpers the verifier uses on served values before any rounding (`decimalText`,
`decimals`, `onGrid8`, `onLattice2`, `u8`); they read data, they are not part of the derivation.
