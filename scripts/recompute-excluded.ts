// the same-account, same-engine limbo bets the platform's ledger holds that the shipped datasets do
// not — an earlier 500-bet capture of 12 Oct — recomputed with this package's own derivation (src/rng.ts, src/rules.ts). The
// file stays in the HouseBets workshop (it carries the audit account's user id, which this script never reads or prints);
// it is identified by its sha256.
//   npm run excluded -- <capture.json>...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { drawU, resultFromU, sha256Hex } from '../src/rng.ts';
import { wins, hund, multiplier8, payout8, u8, onLattice2 } from '../src/rules.ts';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const out: any[] = [];
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const t = { bets: 0, seedHash: 0, result: 0, win: 0, multiplier: 0, payout: 0, answer: 0, bad: [] as string[] };
  for (const b of d.bets) {
    t.bets++;
    const sd = d.seeds.find((x: any) => Number(x.epoch) === b.epoch);
    if (!sd || !sd.revealedServerSeed) { t.bad.push(`bet ${b.idx}: no revealed seed`); continue; }
    if (sha256Hex(sd.revealedServerSeed) === sd.hashedServerSeed) t.seedHash++; else t.bad.push(`bet ${b.idx}: seed hash`);
    const R = resultFromU(drawU(sd.revealedServerSeed, sd.clientSeed, b.nonce));
    if (onLattice2(b.outcome) && R === hund(b.outcome)) t.result++; else t.bad.push(`bet ${b.idx}: result ${R / 100} served ${b.outcome}`);
    const T = hund(b.setting.target), w = wins(T, R);
    if (w === (b.payoutMultiplier > 0)) t.win++; else t.bad.push(`bet ${b.idx}: win`);
    const m8 = w ? multiplier8(T) : 0n;
    if (u8(b.payoutMultiplier) === m8) t.multiplier++; else t.bad.push(`bet ${b.idx}: multiplier`);
    const st8 = u8(b.stake);
    if (st8 !== null && u8(b.payout) === payout8(st8, m8)) t.payout++; else t.bad.push(`bet ${b.idx}: payout`);
    const g = b._raw?.game, gg = g?.game;
    if (gg && g.outcome === b.outcome && gg.nonce === b.nonce && gg.clientSeed === b.respClientSeed && gg.hashedSeed === b.respHashedSeed && b.respHashedSeed === sd.hashedServerSeed && b.respClientSeed === sd.clientSeed
      && u8(gg.payout) === u8(b.payout) && u8(gg.payoutMultiplier) === u8(b.payoutMultiplier) && u8(gg.amount) === st8) t.answer++; else t.bad.push(`bet ${b.idx}: answer != copy`);
  }
  const at = d.bets.map((b: any) => b.at).sort();
  out.push({ file: basename(f), sha256: sha(f), engine: [...new Set(d.bets.map((b: any) => b.fairnessVersion))], placed: [at[0], at.at(-1)], seeds: d.seeds.length, revealed: d.seeds.filter((s: any) => s.revealedServerSeed).length, ...t, bad: t.bad.slice(0, 5) });
}
for (const o of out) console.log(JSON.stringify(o));
const allOk = out.every((o) => o.bets > 0 && ['seedHash', 'result', 'win', 'multiplier', 'payout', 'answer'].every((k) => o[k] === o.bets));
console.log(`excluded captures: ${out.reduce((a, o) => a + o.bets, 0)} bets in ${out.length} files; every bet recomputes (seed hash, result, win, multiplier, payout, answer == copy): ${allOk}`);
process.exitCode = allOk ? 0 : 1;
