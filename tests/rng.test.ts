// LIMBO-09 RNG reference vectors: the worked examples of HouseBets' own published limbo spec
// (GET /housegames/limbo/fairness, read 12 Oct 2026, evidence E01: each example carries the draw u it reads).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawU, resultFromU, resultExactH, winningDraws } from '../src/rng.ts';
import { multiplier8, payout8, units8, hund } from '../src/rules.ts';
import { SPEC_VECTORS, NUMERATOR, TWO32 } from '../src/spec.ts';
import { load, PRIMARY_FILE } from '../src/loader.ts';

for (const v of SPEC_VECTORS) {
  test(`spec example ${v.clientSeed}:${v.nonce} -> draw ${v.draw}, result ${(v.resultH / 100).toFixed(2)}`, () => {
    assert.equal(drawU(v.serverSeed, v.clientSeed, v.nonce), v.draw);
    assert.equal(resultFromU(v.draw), v.resultH);
  });
}
test('u = 0 reaches the 1,000,000x cap; the last draw gives the 1.00x floor', () => {
  assert.equal(resultFromU(0), 100_000_000);
  assert.equal(resultFromU(TWO32 - 1), 100);
});
test('target 1.32: the draw 0.75 x 2^32 is exactly 99 x 2^32 / 132 — the float formula gives 1.31, the exact form 1.32 (DL-4)', () => {
  assert.equal(NUMERATOR % 132, 0);
  assert.equal(resultFromU(NUMERATOR / 132), 131);
  assert.equal(resultExactH(NUMERATOR / 132), 132);
  assert.deepEqual(winningDraws(132), { count: NUMERATOR / 132, exact: NUMERATOR / 132 + 1, ok: true });
});
test('multiplier on a win = the target, payout floor at 1e-8', () => {
  assert.equal(multiplier8(109), 109000000n);
  assert.equal(payout8(units8('0.01000311'), multiplier8(109)), units8('0.01090338'));
});
// a real winner from the primary dataset: the first winning bet (idx 12, target 1.09, result 1.62, payout 0.01090338)
test('captured bet idx 12 recomputes from its revealed seed', () => {
  const ds = load(PRIMARY_FILE);
  const b = ds.bets.find((x) => x.idx === 12)!;
  const s = ds.seeds.find((x) => Number(x.epoch) === b.epoch)!;
  assert.equal(resultFromU(drawU(s.revealedServerSeed, s.clientSeed, b.nonce)), hund(b.outcome));
  assert.equal(hund(b.outcome), 162);
  assert.equal(units8(b.payout), payout8(units8(b.stake), multiplier8(hund(b.setting.target))));
});
