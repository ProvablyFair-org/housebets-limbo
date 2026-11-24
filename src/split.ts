// The Phase A split, single-sourced: scripts/split-whole-epochs.mjs writes the files with it and the verifier (DICE-05)
// re-runs it on the captured file shipped in data/captured/ (the as-captured file with the audit account's user id
// redacted, scripts/redact-user-id.mjs, data/REDACTION.txt) and requires the primary and tail files byte for byte.
//   primary = every whole epoch (exactly meta.epochSize bets); tail = the one short last epoch, which exists only because
//   the 12 Oct 2026 rig treated the server's transient 400 "Transaction temporarily unavailable" as a refusal and skipped
//   the plan slot (no nonce used). Records are copied unchanged; the only addition is meta.split. Written with the capture
//   rig's own serialiser call (JSON.stringify(obj, null, 2)), after proving that call reproduces the as-captured bytes.
import { createHash } from 'node:crypto';

export interface SplitResult { primaryName: string; primaryText: string; tailName: string | null; tailText: string | null }

export function splitWholeEpochs(text: string, asCapturedName: string, game: string): SplitResult {
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const ds = JSON.parse(text);
  if (JSON.stringify(ds, null, 2) !== text) throw new Error('the rig serialiser does not reproduce the as-captured bytes');
  const E = ds.meta.epochSize;
  if (!(E > 0)) throw new Error('meta.epochSize missing');
  const byEpoch = new Map<number, number>();
  for (const b of ds.bets) byEpoch.set(b.epoch, (byEpoch.get(b.epoch) || 0) + 1);
  const epochs = [...byEpoch.keys()].sort((a, b) => a - b);
  if (epochs.length !== ds.seeds.length || epochs.some((e, i) => e !== i)) throw new Error('epochs are not 0..seeds-1');
  if (ds.seeds.some((s: any, i: number) => Number(s.epoch) !== i)) throw new Error('seeds[i].epoch != i');
  const short = epochs.filter((e) => byEpoch.get(e) !== E);
  const last = epochs[epochs.length - 1];
  if (short.length > 1 || (short.length === 1 && short[0] !== last)) throw new Error(`a short epoch other than the last: ${short}`);
  const k = short.length ? last : epochs.length;
  const asCaptured = { file: asCapturedName, sha256: sha(text), bets: ds.bets.length, seeds: ds.seeds.length };
  const rule = `primary = the ${k} whole epochs of ${E} bets; tail = the short last epoch (${short.length ? byEpoch.get(last) : 0} bets). Records copied unchanged from the captured file (the as-captured file with the audit account\'s user id redacted, data/REDACTION.txt).`;
  const why = 'the 12 Oct rig treated the server\'s transient 400 "Transaction temporarily unavailable" as a refusal and skipped the plan slot; no nonce was used (nonces 1..N with no gap, N == the server nonce at rotation, every epoch); only the last epoch is short';
  const primary = { ...ds, meta: { ...ds.meta, split: { part: 'primary', asCaptured, rule, why, epochs: [0, k - 1], bets: 0, seeds: k } }, seeds: ds.seeds.slice(0, k), bets: ds.bets.filter((b: any) => b.epoch < k) };
  primary.meta.split.bets = primary.bets.length;
  const out: SplitResult = { primaryName: `housebets-${game}-phaseA-${primary.bets.length}bets.json`, primaryText: JSON.stringify(primary, null, 2), tailName: null, tailText: null };
  if (short.length) {
    const tail = { ...ds, meta: { ...ds.meta, split: { part: 'tail', asCaptured, rule, why, epochs: [last, last], bets: 0, seeds: 1 } }, seeds: ds.seeds.slice(last), bets: ds.bets.filter((b: any) => b.epoch === last) };
    tail.meta.split.bets = tail.bets.length;
    delete tail.preCapture;   // the pre-capture anchor belongs to epoch 0, in the primary file
    out.tailName = `housebets-${game}-phaseA-tail-${tail.bets.length}bets.json`; out.tailText = JSON.stringify(tail, null, 2);
  }
  const back = [...primary.bets, ...(short.length ? ds.bets.filter((b: any) => b.epoch === last) : [])];
  if (back.length !== ds.bets.length || back.some((b: any, i: number) => JSON.stringify(b) !== JSON.stringify(ds.bets[i]))) throw new Error('records not preserved');
  return out;
}
