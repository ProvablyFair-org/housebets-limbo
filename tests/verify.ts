// HouseBets House Games limbo (new engine, canonical-v2) — verification suite: the 31 checks of the LIMBO profile
// (src/profile-map.ts, generated from the framework's games/limbo/profile.public.json 1.0.4-public, Framework 1.1). Run: npm run verify (Node 22, no install).
// Status by policy: HARD_FAIL → PASS | FAIL; FLAG → PASS | FLAG (origin operator or capture); INFORMATIONAL → INFO;
// GRADED / RELEASE_GATE (package checks) → PASS | GAP, reported, not in the verdict — except a release-gate record
// (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing or not the bytes RELEASE-MANIFEST.json pins: FAIL,
// and the verdict is NOT PROVABLY FAIR. A step that throws is scored FAIL, never skipped (step(), below).
// Verdict, ranked as RTP-CLAIM 1.2.0's rtpClaimVerdict: any FAIL → NOT PROVABLY FAIR (exit 1) > a scored check with no status
// from this run → INCOMPLETE (exit 3; never a pass) > LIMBO-19 OVERSTATED → RTP FIGURE OVERSTATED (exit 5, Methodology
// v1.1) > an operator-origin FLAG → Conditional Pass (exit 2) > Full Pass (exit 0). A stale verify.js → exit 4, no verdict.
// A capture-origin FLAG is disclosed with a limitation row and is verdict-neutral (policy decided 2026-09-17).
// The published figures (RTP claim, limits, vectors, formula constants) are read from the pinned exhibits (src/exhibits.ts),
// and the src/spec.ts copies are held equal to them (LIMBO-26); the scored list and every row's policy come from the vendored
// framework profile (profile/profile.json, pinned below), src/profile-map.ts is held equal to it, and a binding that does not
// hold withholds the verdict (INCOMPLETE, exit 3); nothing but the rule decides an RTP miss (no label, FLAG or claimed-figure
// test runs before it); a committed RTP table or record that no longer equals the run stays a reproduction failure, exit 1,
// miss or no miss (the framework rule).
// verify writes only outputs/run/ and never rewrites a pinned artifact.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, load, sha256File, sha256Bytes, readJson, PRIMARY_FILE, PRIMARY_SHA256, TAIL_FILE, TAIL_SHA256, AS_CAPTURED_FILE,
  AS_CAPTURED_SHA256, PHASE_C_FILE, PHASE_C_SHA256, PHASE_C10_FILE, PHASE_C10_SHA256, PHASE_D_FILE, PHASE_D_SHA256, EVIDENCE_PINS,
  EXPECTED_BETS, EXPECTED_SEEDS, EXPECTED_EPOCHS, EXPECTED_EPOCH_SIZE, EXPECTED_TAIL_BETS, EXPECTED_PHASE_C_BETS, EXPECTED_PHASE_C10_BETS,
  EXPECTED_PHASE_D_BETS, PHASE_C_STAKE, PHASE_C_TARGET_H, PHASE_C10_STAKE, PHASE_C10_TARGET_H, PHASE_D_SEEDS, E05_ROWS, NONCE_BASE, PLAN_CLASSES,
  PLAN_CLASS_FLOOR, PLAN_DECADES, DECADE_FLOOR } from '../src/loader.ts';
import { drawU, resultFromU, resultExactH, winningDraws, sha256Hex } from '../src/rng.ts';
import * as RNG from '../src/rng.ts';
import { wins, hund, units8, u8, onGrid8, onLattice2, multiplier8, payout8 } from '../src/rules.ts';
import { MIN_RESULT_H, MAX_RESULT_H, MIN_TARGET_H, MAX_TARGET_H, TWO32, HOUSE_EDGE } from '../src/spec.ts';
import { PROFILE, PROFILE_SHA256, PROFILE_VERSION, type Policy, type ProfileCheck } from '../src/profile-map.ts';
import { bindProfile, PROFILE_FILE } from '../src/profile-bind.ts';
import { readExhibits } from '../src/exhibits.ts';
import { splitWholeEpochs } from '../src/split.ts';
import { census, censusText, type Census } from '../src/simulate.ts';
import { SIM_UNIFORMITY_DRAWS, SIM_UNIFORMITY_BINS, SIM_EDGE_TARGETS_H, SIM_EDGE_BETS, EDGE_SIGMAS, EDGE_BUFFER, ALPHA_SCREEN,
  SIM_PASS2_NONCES, SIM_PASS2_ALPHA, SIM_PASS2_MAX_TARGET_H, FLOOR_UNIFORMITY_DRAWS, FLOOR_BAND_BETS, FLOOR_BANDS, FLOOR_PASS2_NONCES, SIM_LONG_TARGET_H, SIM_LONG_BETS, SIM_TABLE_BETS, SIM_TABLE_TARGETS_H, FLOOR_CONVERGENCE_BETS, FLOOR_EDGE_TABLE_BETS, FLOOR_EDGE_TABLE_TARGETS } from '../src/sim-config.ts';
import { chiSquaredPValue, runsStatisticFromCounts, twoSidedNormalP, normalLowerTailP, normalQuantile, ksTest, lagOneAutocorrelation, waldsWolfowitzRunsTest } from '../src/stats.ts';
import { edgeBandFalseAlarm, uniformityScreenFalseAlarm, FAIL_FALSE_ALARM_CAP, fmtRate } from '../src/false-alarm.ts';
import { PASS2_FALSE_ALARM } from '../src/false-alarm-pass2.ts';
import { computeRtpClaim, runRtpClaimGate, rtpClaimFromExhibits, type GridScan } from '../src/rtp-settings.ts';
import { RTP_CLAIM_RULE_ENFORCED, rtpClaimVerdict, rtpClaimStatus } from '../src/rtp-claim';
import { ARTIFACT_PINS, AUDIT_ID, SITE_VERIFIER_PIN } from '../src/artifact-pins.ts';
import { loadSiteModule, replay, exportNames, type Probe } from '../src/site-verifier.ts';
import { fieldDiff, beyondTolerance } from '../src/diff.ts';
import type { Dataset, Bet } from '../src/types.ts';

type Status = 'PASS' | 'FAIL' | 'FLAG' | 'INFO' | 'GAP' | 'NOT_RUN' | 'OVERSTATED';
interface Row { id: string; name: string; policy: Policy; status: Status; origin?: 'operator' | 'capture'; detail: string }
const rows: Row[] = [];
// ═══ A step that throws is scored, never skipped ═══
// Every check below runs inside step(). An exception in a step (a file missing, a dataset field null or absent) marks the
// check(s) that step scores FAIL, with the error in the detail, and the next step still runs. A shared input that cannot be
// computed (input()) becomes a value that throws on first use and names itself, so every step that reads it fails on its own
// row. Any such error makes the verdict NOT PROVABLY FAIR (exit 1). An exception outside every step still prints every row,
// each check it left unscored as FAIL, and exits 1.
const RUN_ERRORS: string[] = [];
const TAINT = new Map<string, string>();
const errText = (e: unknown): string => { const x = e as { code?: string; name?: string; message?: string } | null; return `${x?.code ?? x?.name ?? 'Error'}: ${String(x?.message ?? e).split('\n')[0]}`; };
function step(ids: string[], fn: () => void): void {
  try { fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`${ids.join(', ') || 'a shared computation'}: ${why}`);
    for (const id of ids) if (!TAINT.has(id)) TAINT.set(id, why);
  }
}
function input<T>(name: string, fn: () => T, ...fallback: [T?]): T {
  try { return fn(); } catch (e) {
    const why = errText(e); RUN_ERRORS.push(`input ${name}: ${why}`);
    // a boolean condition that cannot be computed is false (it fails the check it feeds); any other input is poisoned
    if (fallback.length) return fallback[0] as T;
    const poison = (): never => { throw new Error(`input ${name} could not be computed (${why})`); };
    return new Proxy(function () {}, { get: poison, apply: poison, construct: poison, has: poison, ownKeys: poison, getOwnPropertyDescriptor: poison }) as unknown as T;
  }
}
function failRow(id: string, detail: string): void {
  const r = rows.find((x) => x.id === id);
  if (r) { const was = `${r.status}: ${r.detail}`; r.status = 'FAIL'; delete r.origin; r.detail = `${detail} (recorded before the error: ${was})`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); }
}
/** Called first in finish(): every check whose step threw becomes FAIL. */
function applyTaint(): void {
  for (const [id, why] of TAINT) failRow(id, `NOT SCORED, the step threw ${why} (an input it reads is missing or malformed); scored FAIL, never skipped`);
  TAINT.clear();
}
/** A release-gate record (outputs/fresh-copy.json, outputs/mutation-results.json) that is missing, not pinned, or not the
 *  bytes RELEASE-MANIFEST.json pins for it: its check is FAIL, and the verdict fails (extraFails). A record that matches its
 *  pin but reports a shortfall stays a GAP. */
function pinFail(id: string, why: string): void {
  const d = `FAIL: the release-gate record is not the one RELEASE-MANIFEST.json pins (${why}); a deleted or edited record fails the verdict`;
  const r = rows.find((x) => x.id === id);
  if (r) { r.status = 'FAIL'; delete r.origin; r.detail = `${d}; ${r.detail}`; }
  else { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail: d }); }
}
/** Verdict-bearing failures outside the scored HARD_FAIL / FLAG rows: a FAIL on a package check (a release-gate record that
 *  is missing or differs from its RELEASE-MANIFEST.json pin) and any run error. */
const extraFails = (): number => rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').length + RUN_ERRORS.length;
process.on('uncaughtException', (e) => {
  try {
    const why = errText(e); RUN_ERRORS.push(`the run stopped outside any step: ${why}`);
    for (const c of PROFILE) if (!rows.some((r) => r.id === c.id) && !TAINT.has(c.id)) TAINT.set(c.id, `${why}; the run stopped before this check`);
    finish();
  } catch (e2) { console.log(`VERDICT: NOT PROVABLY FAIR — the verifier stopped: ${errText(e)}; ${errText(e2)}`); }
  process.exit(1);
});
/** the framework profile this package is certified under — sha256 of the framework's games/limbo/profile.public.json
 *  1.0.4-public (Framework 1.1), the file vendored byte for byte at profile/profile.json and cited in MANIFEST.md. Pinned here, in the
 *  verifier itself, as well as in src/profile-map.ts: editing the map alone cannot move it. */
const PROFILE_PIN = 'c5a7be5e09e5c94846e19e7c9b6619e358d005c5c0614bdacdc697e59abbb530';
const binding = bindProfile(PROFILE_PIN);
const manifestText = existsSync(join(ROOT, 'MANIFEST.md')) ? readFileSync(join(ROOT, 'MANIFEST.md'), 'utf8') : '';
const manifestCitesProfile = manifestText.includes(PROFILE_PIN);
/** The binding as a whole: the vendored file is the pinned one, src/profile-map.ts equals it row for row, the MANIFEST cites it. */
const bindingOk = binding.ok && manifestCitesProfile;
/** Every row is recorded under the vendored profile's policy (src/profile-map.ts only when the vendored file is not the pinned
 *  one, and then the verdict is withheld anyway). */
const PROFILE_OF_RECORD: readonly ProfileCheck[] = binding.fileOk ? binding.checks : PROFILE;
const prof = (id: string) => { const p = PROFILE_OF_RECORD.find((c) => c.id === id) ?? PROFILE.find((c) => c.id === id); if (!p) throw new Error(`no profile check ${id}`); return p; };
/** Record a check by its profile policy. `ok` false → FAIL / FLAG / GAP; INFORMATIONAL is always INFO. */
function record(id: string, ok: boolean, detail: string, origin: 'operator' | 'capture' = 'operator') {
  const p = prof(id); let status: Status;
  if (p.policy === 'INFORMATIONAL') status = 'INFO';
  else if (p.policy === 'HARD_FAIL') status = ok ? 'PASS' : 'FAIL';
  else if (p.policy === 'FLAG') status = ok ? 'PASS' : 'FLAG';
  else status = ok ? 'PASS' : 'GAP';
  rows.push({ id, name: p.name, policy: p.policy, status, ...(status === 'FLAG' ? { origin } : {}), detail });
}
/** RTP-CLAIM 1.2.0 (Methodology v1.1; src/rtp-claim-switch.ts ON): the -19 status. `ok` carries the step's own
 *  conditions besides the rule (the exact derivation, the claim read from the exhibits): if one fails, the profile's policy
 *  applies as before. With those clean the rule decides: PASS, or OVERSTATED for a house-side miss of the published figure
 *  (verdict RTP FIGURE OVERSTATED, exit 5 — never NOT PROVABLY FAIR, the draws are checked by the other steps). A committed
 *  RTP table that does not equal this run's is a reproduction failure: FAIL, whatever the rule says. */
function recordRtpClaim(id: string, ok: boolean, gate: { status: 'INFO' | 'PASS' | 'OVERSTATED' | 'FAIL'; tableMatches: boolean }, detail: string) {
  const p = prof(id);
  if (!gate.tableMatches || gate.status === 'FAIL') { rows.push({ id, name: p.name, policy: p.policy, status: 'FAIL', detail }); return; }
  if (!ok) { record(id, false, detail); return; }
  rows.push({ id, name: p.name, policy: p.policy, status: gate.status, detail });
}
/** A HARD_FAIL / FLAG check whose only shortfall is an auditor-side capture gap: a capture-origin FLAG (verdict-neutral). */
const captureFlag = (id: string, detail: string) => { const p = prof(id); rows.push({ id, name: p.name, policy: p.policy, status: 'FLAG', origin: 'capture', detail }); };
const pct = (a: number, b: number) => `${a}/${b}`;
/** the scored checks of the profile (HARD_FAIL + FLAG). finish() compares the checks that have a status from THIS run
 *  with this list; any one missing (deleted, skipped, aborted) withholds the verdict: INCOMPLETE, exit 3. */
const EXPECTED_STEPS: readonly string[] = binding.scored;   // from the vendored profile, never from src/profile-map.ts
const t0 = Date.now();

// ═══ LIMBO-26 dataset & config pins — before anything reads the data ═══
const dataPins: [string, string][] = [[PRIMARY_FILE, PRIMARY_SHA256], [TAIL_FILE, TAIL_SHA256], [AS_CAPTURED_FILE, AS_CAPTURED_SHA256],
  [PHASE_C_FILE, PHASE_C_SHA256], [PHASE_C10_FILE, PHASE_C10_SHA256], [PHASE_D_FILE, PHASE_D_SHA256]];
const pinBad = [...dataPins, ...EVIDENCE_PINS].filter(([f, h]) => sha256File(f) !== h).map(([f]) => f);
if (!binding.fileOk) pinBad.push(`${PROFILE_FILE} (sha256 ${binding.fileSha256 ?? 'ABSENT'}, pinned ${PROFILE_PIN})`);
if (pinBad.length) { record('LIMBO-26', false, `mismatch: ${pinBad.join(', ')} — abort before any step`); finish(); process.exit(1); }
// the exhibits are the pinned ones; read the published figures from them, and hold the src/spec.ts copies to them
const ex = input('ex', () => (readExhibits()));

const ds = input('ds', () => (load(PRIMARY_FILE))), tail = input('tail', () => (load(TAIL_FILE))), pC = input('pC', () => (load(PHASE_C_FILE))), pC10 = input('pC10', () => (load(PHASE_C10_FILE))), pD = input('pD', () => (load(PHASE_D_FILE)));
const ALL = input('ALL', () => ([ds, tail, pC, pC10, pD]));
const asText = input('asText', () => (readFileSync(join(ROOT, 'data', AS_CAPTURED_FILE), 'utf8')));
const asCaptured = input('asCaptured', () => (JSON.parse(asText) as Dataset & { meta: any }));
// the audit account's user id is redacted in every shipped dataset (data/REDACTION.txt, scripts/redact-user-id.mjs)
step(['LIMBO-26'], () => {
  const NIL_UUID = '00000000-0000-0000-0000-000000000000';
  const uid = { redacted: 0, nil: 0, other: 0 };
  const walkUid = (o: any): void => {
    if (Array.isArray(o)) { for (const v of o) walkUid(v); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) { if (k === 'userId') { if (v === 'redacted') uid.redacted++; else if (v === NIL_UUID) uid.nil++; else uid.other++; } walkUid(v); }
  };
  const shipped: any[] = [ds, tail, pC, pC10, pD, asCaptured];
  for (const d of shipped) walkUid(d);
  const perBet = shipped.every((d) => d.bets.every((b: any) => b._raw?.game?.userId === 'redacted'));
  record('LIMBO-26', uid.other === 0 && perBet && ex.mismatches.length === 0, `${dataPins.length} datasets + ${EVIDENCE_PINS.length} evidence exhibits match their sha256 pinned in src/loader.ts, and ${PROFILE_FILE} the framework profile's sha256 ${PROFILE_PIN.slice(0, 12)}…; the src/spec.ts constants equal the values parsed from the pinned exhibits E01–E03: ${ex.compared - ex.mismatches.length}/${ex.compared}${ex.mismatches.length ? ` — differ: ${ex.mismatches.join('; ')}` : ''}; the audit account's user id is redacted in the shipped datasets (data/REDACTION.txt): userId values "redacted" ${uid.redacted}, nil UUID ${uid.nil}, any other value ${uid.other}; every bet's _raw.game.userId == "redacted": ${perBet}`);
});
const seedOf = (d: Dataset, e: number) => d.seeds.find((s) => Number(s.epoch) === e);

/** The per-round recompute core (result, exact-rational agreement, win rule, multiplier, payout, server-record copy).
 *  every field the package takes from the server's answer is compared between the raw answer kept in the dataset
 *  (`_raw.game`, `_raw.game.game`) and the copy the recompute uses: the draw fields (result, nonce, client seed, hashed seed,
 *  seed pair, echoed target) feed LIMBO-07 (`answerDraw`), the money fields (stake, payout, multiplier, round id) feed
 *  LIMBO-11 (`answerPay`). a result off the 0.01 lattice or a money value off the 1e-8 grid is a mismatch, checked on
 *  the value as given, before any rounding. */
// the game page's own result function, E02 functions['resultFromUint32V2 (kc)'] with E02's constant line, executed from the
// pinned exhibit's text on every bet's draw: a second check beside src/rng.ts (which follows the same published formula), not
// its source. The exhibit holds the page's result function only; the draw u is src/rng.ts drawU.
const e2page = input('e2page', () => (readJson('evidence/E02-limbo-rules-panel-2026-10-10.json')));
let pageKc: ((u: number) => number) | null = null; let pageErr = '';
step(['LIMBO-05'], () => { try { pageKc = new Function(`${e2page.constants?.text};${e2page.functions?.['resultFromUint32V2 (kc)']};return kc;`)() as (u: number) => number; } catch (e: any) { pageErr = String(e.message); } });
function recompute(d: Dataset) {
  const c = { n: 0, result: 0, page: 0, exactSame: 0, echo: 0, win: 0, mult: 0, winners: 0, loserZero: 0, losers: 0, pay: 0, copies: 0, seedLink: 0, range: 0,
    answerDraw: 0, answerPay: 0, offLattice: 0, offGrid: 0, bad: [] as string[] };
  for (const b of d.bets) {
    c.n++;
    const s = seedOf(d, b.epoch);
    if (!s) { c.bad.push(`bet ${b.idx}: no seed for epoch ${b.epoch}`); continue; }
    if (b.respClientSeed === s.clientSeed && b.respHashedSeed === s.hashedServerSeed) c.seedLink++; else c.bad.push(`bet ${b.idx}: answer seeds differ from epoch ${b.epoch}`);
    const g: any = (b as any)._raw?.game, gg: any = g?.game;
    if (g && gg && g.outcome === b.outcome && gg.nonce === b.nonce && gg.clientSeed === b.respClientSeed && gg.hashedSeed === b.respHashedSeed && String(g.seedId) === String(s.seedId) && gg.seedId === g.seedId && g.betNumber === b.echoedTarget) c.answerDraw++;
    else c.bad.push(`bet ${b.idx}: the server's answer (result, nonce, seeds, target) != the copy`);
    const lat = onLattice2(b.outcome) && onLattice2(g?.outcome);
    if (!lat) { c.offLattice++; c.bad.push(`bet ${b.idx}: result ${b.outcome} off the 0.01 lattice`); }
    const u = drawU(s.revealedServerSeed, s.clientSeed, b.nonce);
    const R = resultFromU(u);
    if (lat && R === hund(b.outcome)) c.result++; else c.bad.push(`bet ${b.idx}: result ${R / 100} served ${b.outcome}`);
    if (lat && pageKc && Math.round(pageKc(u) * 100) === hund(b.outcome)) c.page++; else c.bad.push(`bet ${b.idx}: the page's result function differs from the served result`);
    if (resultExactH(u) === R) c.exactSame++;
    if (R >= MIN_RESULT_H && R <= MAX_RESULT_H) c.range++;
    const T = hund(b.setting.target);
    if (hund(b.echoedTarget) === T && hund(b.request.betNumber) === T) c.echo++; else c.bad.push(`bet ${b.idx}: target sent/echoed ${b.request.betNumber}/${b.echoedTarget} setting ${b.setting.target}`);
    const r: any = b._raw?.round;
    const grid = [b.stake, b.payout, b.payoutMultiplier, b.roundStake, r?.stake, r?.payout, gg?.amount, gg?.payout, gg?.payoutMultiplier].every(onGrid8);
    if (!grid) { c.offGrid++; c.bad.push(`bet ${b.idx}: a money value off the 1e-8 grid`); }
    const w = wins(T, R);
    if (w === (b.payoutMultiplier > 0)) c.win++; else c.bad.push(`bet ${b.idx}: win ${w} served multiplier ${b.payoutMultiplier}`);
    const m8 = w ? multiplier8(T) : 0n;
    const pm = u8(b.payoutMultiplier), st8 = u8(b.stake), py8 = u8(b.payout);
    if (w) { c.winners++; if (pm !== null && pm === m8) c.mult++; else c.bad.push(`bet ${b.idx}: multiplier ${b.payoutMultiplier} want ${m8}e-8`); }
    else { c.losers++; if (pm === 0n) c.loserZero++; }
    if (grid && st8 !== null && py8 !== null && py8 === payout8(st8, m8)) c.pay++; else c.bad.push(`bet ${b.idx}: payout ${b.payout} want ${st8 === null ? '?' : payout8(st8, m8)}e-8`);
    if (r && grid && u8(r.stake) === u8(b.roundStake) && u8(r.stake) === st8 && u8(r.payout) === py8 && r.roundId === b.roundId) c.copies++; else c.bad.push(`bet ${b.idx}: copy != server round`);
    if (gg && grid && u8(gg.amount) === st8 && u8(gg.payout) === py8 && u8(gg.payoutMultiplier) === pm && gg.roundId === b.roundId && g.gameId === b.roundId) c.answerPay++;
    else c.bad.push(`bet ${b.idx}: the server's answer (stake, payout, multiplier, round id) != the copy`);
  }
  return c;
}

// ═══ LIMBO-05 population & epoch size (G-BIND) + the split re-run from the captured file (as-captured, user id redacted) ═══
step(['LIMBO-05'], () => {
  const perEpoch = new Map<number, number>();
  for (const b of ds.bets) perEpoch.set(b.epoch, (perEpoch.get(b.epoch) || 0) + 1);
  const sizesOk = [...perEpoch.values()].every((n) => n === EXPECTED_EPOCH_SIZE);
  let splitOk = false, splitDetail = '';
  try {
    const r = splitWholeEpochs(asText, AS_CAPTURED_FILE.split('/').pop()!, 'limbo');
    splitOk = r.primaryText === readFileSync(join(ROOT, 'data', PRIMARY_FILE), 'utf8') && r.tailText === readFileSync(join(ROOT, 'data', TAIL_FILE), 'utf8');
    splitDetail = splitOk ? 'the split re-run from the captured file (the as-captured file with the user id redacted, data/REDACTION.txt) reproduces both files byte for byte' : 'the split re-run does NOT reproduce the files';
  } catch (e: any) { splitDetail = `split re-run failed: ${e.message}`; }
  const counts = { C: pC.bets.length, C10: pC10.bets.length, D: pD.bets.length };
  const ok = ds.bets.length === EXPECTED_BETS && ds.seeds.length === EXPECTED_SEEDS && perEpoch.size === EXPECTED_EPOCHS && sizesOk
    && tail.bets.length === EXPECTED_TAIL_BETS && counts.C === EXPECTED_PHASE_C_BETS && counts.C10 === EXPECTED_PHASE_C10_BETS && counts.D === EXPECTED_PHASE_D_BETS && splitOk;
  // the capture's own clock (each bet's `at`), printed for the record, never used by a verdict step
  const span = (d: Dataset) => { const at = d.bets.map((b: any) => String(b.at)).sort(); return `${at[0]} … ${at[at.length - 1]}`; };
  record('LIMBO-05', ok, `Phase A ${ds.bets.length} bets / ${ds.seeds.length} seeds / ${perEpoch.size} epochs, every epoch ${EXPECTED_EPOCH_SIZE}: ${sizesOk}; tail ${tail.bets.length} (own file, disclosed DL-1); the captured file ${asCaptured.bets.length} bets / ${asCaptured.seeds.length} seeds; supplementary C ${counts.C}, C $10 ${counts.C10}, D ${counts.D} — against src/loader.ts constants, never meta; ${splitDetail}; bets placed (the capture's clock, printed, not checked): Phase A ${span(ds)}, tail ${span(tail)}, C ${span(pC)}, C $10 ${span(pC10)}, D ${span(pD)}`);
});

// ═══ LIMBO-01 seed hash integrity (every revealed seed of every dataset) ═══
step(['LIMBO-01'], () => {
  const all = ALL.flatMap((d) => d.seeds);
  const ok = all.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  const primOk = ds.seeds.filter((s) => sha256Hex(s.revealedServerSeed) === s.hashedServerSeed).length;
  record('LIMBO-01', ok === all.length && primOk === EXPECTED_SEEDS, `sha256(utf8(revealed)) == committed: ${pct(primOk, EXPECTED_SEEDS)} Phase A seeds, ${pct(ok, all.length)} across Phase A, tail, C, C $10 and D; 0 unverifiable bets`);
});

// ═══ LIMBO-02 forward commitment chain, anchored before epoch 0 ═══
step(['LIMBO-02'], () => {
  const chainOf = (d: Dataset) => { let n = 0; for (let i = 0; i + 1 < d.seeds.length; i++) if (d.seeds[i].hashedNextServerSeed === d.seeds[i + 1].hashedServerSeed) n++; return n; };
  const anchor = (d: any) => d.preCapture && d.preCapture.hashedNextServerSeed === d.seeds[0].hashedServerSeed;
  const prim = chainOf(ds), link = ds.seeds[ds.seeds.length - 1].hashedNextServerSeed === tail.seeds[0].hashedServerSeed;
  const post = asCaptured.meta.postCapture?.activePair;
  const end = !!post && tail.seeds[tail.seeds.length - 1].hashedNextServerSeed === (post.seed?.hashedServerSeed ?? post.hashedServerSeed);
  const sup = [pC, pC10, pD].map((d) => ({ n: chainOf(d), of: d.seeds.length - 1, anchor: anchor(d) }));
  const ok = prim === EXPECTED_SEEDS - 1 && anchor(ds) && link && end && sup.every((s) => s.n === s.of && s.anchor);
  record('LIMBO-02', ok, `Phase A ${pct(prim, EXPECTED_SEEDS - 1)} links, pre-capture anchor ${anchor(ds)}, Phase A → tail link ${link}, tail → pair active after the capture ${end}; C ${sup[0].n}/${sup[0].of} anchor ${sup[0].anchor}, C $10 ${sup[1].n}/${sup[1].of} anchor ${sup[1].anchor}, D ${sup[2].n}/${sup[2].of} anchor ${sup[2].anchor}`);
});

// ═══ LIMBO-03 hash consistency within epoch ═══
step(['LIMBO-03'], () => {
  let ok = 0;
  for (const s of ds.seeds) { const bs = ds.bets.filter((b) => b.epoch === Number(s.epoch)); if (bs.every((b) => b.respHashedSeed === s.hashedServerSeed && b.respClientSeed === s.clientSeed)) ok++; }
  record('LIMBO-03', ok === EXPECTED_EPOCHS, `${pct(ok, EXPECTED_EPOCHS)} epochs: every bet carries its epoch's server-seed hash and client seed in the server's answer`);
});

// ═══ LIMBO-04 nonce continuity ═══
step(['LIMBO-04'], () => {
  let ok = 0; const bad: string[] = [];
  for (const s of ds.seeds) {
    const e = Number(s.epoch); const ns = ds.bets.filter((b) => b.epoch === e).map((b) => b.nonce).sort((a, b) => a - b);
    if (ns.length === EXPECTED_EPOCH_SIZE && ns.every((n, i) => n === NONCE_BASE + i) && ns.length === Number(s.serverNonceAtRotation)) ok++; else bad.push(String(e));
  }
  record('LIMBO-04', ok === EXPECTED_EPOCHS, `${pct(ok, EXPECTED_EPOCHS)} epochs: nonces exactly ${NONCE_BASE}..${EXPECTED_EPOCH_SIZE}, once each, no gap, repeat or reorder, and N == the server's nonce read at rotation${bad.length ? `; bad epochs ${bad.join(',')}` : ''}`);
});

// ═══ LIMBO-07 / 10 / 13 / 11 on Phase A ═══
const p = input('p', () => (recompute(ds)));
const supRec = input('supRec', () => ([tail, pC, pC10, pD].map(recompute)));
const supAll = input('supAll', () => (supRec.reduce((a, c) => ({ n: a.n + c.n, result: a.result + c.result, page: a.page + c.page, exactSame: a.exactSame + c.exactSame, pay: a.pay + c.pay, win: a.win + c.win, mult: a.mult + c.mult, winners: a.winners + c.winners,
  answerDraw: a.answerDraw + c.answerDraw, answerPay: a.answerPay + c.answerPay, copies: a.copies + c.copies, offLattice: a.offLattice + c.offLattice, offGrid: a.offGrid + c.offGrid }),
  { n: 0, result: 0, page: 0, exactSame: 0, pay: 0, win: 0, mult: 0, winners: 0, answerDraw: 0, answerPay: 0, copies: 0, offLattice: 0, offGrid: 0 })));
step(['LIMBO-07'], () => { record('LIMBO-07', p.result === p.n && p.seedLink === p.n && p.n === EXPECTED_BETS && p.exactSame === p.n && supAll.result === supAll.n && p.answerDraw === p.n && supAll.answerDraw === supAll.n && p.page === p.n && supAll.page === supAll.n,
  `result == the published formula (E01: u = first 4 bytes of HMAC-SHA256(serverSeed, clientSeed:nonce:0), floor(1e8/(u/2^32·1e8)·0.99·100)/100 in [1.00, 1e6]) on the 0.01× lattice, compared exactly: ${pct(p.result, p.n)} Phase A, ${pct(supAll.result, supAll.n)} tail + C + C $10 + D; the exact rational form floor(99·2^32/u) gives the same result on ${pct(p.exactSame + supAll.exactSame, p.n + supAll.n)}; the game page's own result function (E02 resultFromUint32V2, run from the exhibit's text on each bet's draw; a second check, not the source of src/rng.ts) == the served result ${pct(p.page, p.n)} Phase A, ${pct(supAll.page, supAll.n)} tail + C + C $10 + D${pageKc ? '' : ` (could not be built from E02: ${pageErr})`}; answer seeds == epoch seeds ${pct(p.seedLink, p.n)}; the server's raw answer (result, nonce, client seed, hashed seed, seed pair, echoed target) == the copy the recompute uses: ${pct(p.answerDraw, p.n)} Phase A, ${pct(supAll.answerDraw, supAll.n)} tail + C + C $10 + D; results compared on the 0.01 lattice as served, off the lattice ${p.offLattice + supAll.offLattice}; coverage ${p.n} == expectedBets${p.bad.length ? ' — ' + p.bad.slice(0, 3).join('; ') : ''}`); });
step(['LIMBO-10'], () => { record('LIMBO-10', p.win === p.n && p.range === p.n && p.echo === p.n,
  `win == (result ≥ target, to the cent) recomputed from the result, never the served flag: ${pct(p.win, p.n)}; every recomputed result in [1.00×, 1,000,000×]: ${pct(p.range, p.n)}; target as sent == echoed == setting ${pct(p.echo, p.n)}`); });
step(['LIMBO-13'], () => {
  // the operator's win-chance field (game.winChance, percent) is compared with the declared 99 ÷ target, never read by the derivation
  let wc = 0, n = 0;
  for (const d of ALL) for (const b of d.bets) { n++; const w = b._raw?.game?.winChance; const T = hund(b.setting.target);
    // round8(99/t %) half up = round(9900·1e8/T) in 1e-8 units, exact integers
    const want = (2n * 990000000000n + BigInt(T)) / (2n * BigInt(T)); if (w !== undefined && u8(w) === want) wc++; }
  const flat = p.mult === p.winners && supAll.mult === supAll.winners;
  record('LIMBO-13', flat && p.loserZero === p.losers && wc === n,
    `multiplier paid on a win == the chosen target exactly (E02 "The payout is your stake × target"): ${pct(p.mult, p.winners)} Phase A winners, ${pct(supAll.mult, supAll.winners)} tail/C/D winners; losers served 0 ${pct(p.loserZero, p.losers)}; the edge sits in the result formula's numerator 0.99 = 1 − E02 HOUSE_EDGE gc ${ex.houseEdgeFormula}, NUMERATOR $s = ${ex.numerator} = 99·2^32 (E02 constants, held equal to src/spec.ts by LIMBO-26); the operator's winChance field equals round8(99 ÷ target %) on ${pct(wc, n)} bets (compared, never used)`);
});
step(['LIMBO-11'], () => { record('LIMBO-11', p.pay === p.n && p.copies === p.n && supAll.pay === supAll.n && supAll.copies === supAll.n && p.answerPay === p.n && supAll.answerPay === supAll.n,
  `payout == floor(stake × target) at 1e-8 on a win, 0 on a loss, every money value on the 1e-8 grid as served: ${pct(p.pay, p.n)} Phase A, ${pct(supAll.pay, supAll.n)} tail/C/D; capture copy == the server's own round record (roundId, stake, payout) ${pct(p.copies, p.n)} Phase A, ${pct(supAll.copies, supAll.n)} tail/C/D; the server's raw answer (stake, payout, multiplier, round id) == the copy ${pct(p.answerPay, p.n)} Phase A, ${pct(supAll.answerPay, supAll.n)} tail/C/D; money values off the grid ${p.offGrid + supAll.offGrid}${p.bad.length ? ' — ' + p.bad.slice(0, 3).join('; ') : ''}`); });

// ═══ The legal-target grid scan, shared by LIMBO-08 and LIMBO-19 (every target 1.01× … 1,000,000×, exact) ═══
const scan: GridScan = { targets: 0, nonMonotone: 0, floatBelowExact: [], floatAboveExact: 0, maxDevOver2_32: 0, atBound: 0, atBoundNonDivisor: 0 };
const claim = input('claim', () => (rtpClaimFromExhibits(ex)));   // the claim from every place the exhibits state it, never a src/ constant
const rtp = input('rtp', () => (computeRtpClaim(claim, scan)));
const gate = input('gate', () => (runRtpClaimGate(rtp)));
const ruleStatus = input('ruleStatus', () => (rtpClaimStatus(rtp)));

// ═══ LIMBO-08 draw bias bound: the float → result mapping over the whole draw domain, per target ═══
step(['LIMBO-08'], () => {
  const ok = scan.targets === MAX_TARGET_H - MIN_TARGET_H + 1 && scan.nonMonotone === 0 && scan.maxDevOver2_32 <= 1 && scan.atBoundNonDivisor === 0 && scan.floatAboveExact === 0;
  record('LIMBO-08', ok, `the draw u is a full 32-bit value (no range reduction); the declared float formula's winning draws counted exactly for every one of ${scan.targets.toLocaleString('en')} legal targets at the monotone step around the exact boundary floor(99·2^32/T) (non-monotone steps: ${scan.nonMonotone}); worst |P(win) − 0.99/target| = ${scan.maxDevOver2_32.toFixed(6)} × 2^-32 (bound: ≤ 2^-32), reached at ${scan.atBound} targets, every one a divisor of 99·2^32 (${scan.atBoundNonDivisor} that are not), where the boundary draw itself wins; the binary64 formula and the exact rational one differ at ${scan.floatBelowExact.length} targets (${scan.floatBelowExact.slice(0, 6).map((t) => (t / 100).toFixed(2)).join(', ')}, …), each by the single draw u = 99·2^32/T, which the float formula scores as T − 0.01: there P(win) is exactly 0.99/target instead of 2^-32 above it (disclosed DL-4)`);
});

// ═══ LIMBO-09 RNG reference vectors (E01 published examples with their draws + a captured bet) ═══
step(['LIMBO-09'], () => {
  const V = ex.vectors;   // read from E01 at run time
  const v = V.filter((x) => drawU(x.serverSeed, x.clientSeed, x.nonce) === x.draw && resultFromU(x.draw) === x.resultH).length;
  const b = ds.bets.find((x) => x.payoutMultiplier > 0)!; const s = seedOf(ds, b.epoch)!;
  const capOk = resultFromU(drawU(s.revealedServerSeed, s.clientSeed, b.nonce)) === hund(b.outcome) && u8(b.payout) === payout8(units8(b.stake), multiplier8(hund(b.setting.target)));
  record('LIMBO-09', V.length > 0 && v === V.length && capOk, `the ${V.length} worked examples of HouseBets' published spec, read from E01 at run time (draw and result) ${pct(v, V.length)}; the first captured winner (bet idx ${b.idx}, target ${b.setting.target}, result ${b.outcome}, payout ${b.payout}) recomputes: ${capOk}; also tests/rng.test.ts`);
});

// ═══ LIMBO-06 client-seed influence, Phase D recomputation, empty-seed control, client-seed generator ═══
step(['LIMBO-06'], () => {
  let changed = 0;
  for (const b of ds.bets) { const s = seedOf(ds, b.epoch)!; if (resultFromU(drawU(s.revealedServerSeed, s.clientSeed + '#wrong', b.nonce)) !== hund(b.outcome)) changed++; }
  // collisions under a wrong seed: two independent draws give the same result with q = Σ_R P(R)², computed exactly from the
  // winning-draw counts (P(R = x) = (w(x) − w(x+0.01)) / 2^32); results above 10,000× are bounded by their total mass squared
  let q = 0, prevW = TWO32;
  for (let x = MIN_TARGET_H; x <= 1_000_000; x++) { const w = winningDraws(x).count; q += ((prevW - w) / TWO32) ** 2; prevW = w; }
  q += (prevW / TWO32) ** 2;
  const bound = (n: number) => n * q + 5 * Math.sqrt(n * q) + 5;
  const coll = ds.bets.length - changed, lam = ds.bets.length * q, collBound = bound(ds.bets.length);
  const d = recompute(pD);
  const seedsInOrder = pD.seeds.map((s) => s.clientSeed);
  const playerSet = PHASE_D_SEEDS.every((x, i) => seedsInOrder[i] === x) && new Set(seedsInOrder).size >= 2;
  let dChanged = 0;   // rule 23b: under the previous epoch's client seed the same nonces give other results
  for (const b of pD.bets) { const s = seedOf(pD, b.epoch)!; const prev = b.epoch === 0 ? (pD as any).preCapture?.clientSeed : seedOf(pD, b.epoch - 1)!.clientSeed; if (prev && resultFromU(drawU(s.revealedServerSeed, prev, b.nonce)) !== hund(b.outcome)) dChanged++; }
  const gen = [ds, tail, pC, pC10].flatMap((x) => x.seeds).map((s) => s.clientSeedSource);
  const csprng = gen.every((g) => g === 'node:crypto randomBytes(16) hex');
  const esc = readJson('evidence/E06-limbo-empty-seed-control-2026-10-13.json').record;
  const ok = changed > 0 && coll <= collBound && d.result === d.n && d.pay === d.n && d.answerDraw === d.n && d.answerPay === d.n && playerSet && dChanged >= d.n - bound(d.n) && csprng && esc.status === 400;
  record('LIMBO-06', ok, `a wrong client seed changes ${pct(changed, ds.bets.length)} results (${coll} same-result collisions, expected ${lam.toFixed(1)} from the exact Σ P(R)² = ${q.toExponential(3)}, bound ${collBound.toFixed(1)}); Phase D: player-set seeds ${JSON.stringify(seedsInOrder)} (predictable, disclosed DL-2, all 4 epochs exposed), ${pct(d.result, d.n)} results and ${pct(d.pay, d.n)} payouts recompute, server answer == copy ${pct(Math.min(d.answerDraw, d.answerPay), d.n)}, ${pct(dChanged, d.n)} change vs the previous client seed; phases A–C: the capture rig's client-seed source label reads "node:crypto randomBytes(16) hex" (a CSPRNG) on ${pct(gen.filter((g) => g === 'node:crypto randomBytes(16) hex').length, gen.length)} seeds (a label check: the code that ran is not re-executed here); empty-seed control: one request, answered HTTP ${esc.status} with a generic error (E06), nothing read afterwards`);
});

// ═══ LIMBO-12 bet-size invariance (Phase C at 100 × minimum, and the $10 set) ═══
step(['LIMBO-12'], () => {
  const chk = (d: Dataset, stake: string, T: number) => {
    const c = recompute(d); const stakeOk = d.bets.every((b) => u8(b.stake) === units8(stake) && u8(b._raw?.round?.stake) === units8(stake));
    const setOk = d.bets.every((b) => hund(b.setting.target) === T && hund(b.request.betNumber) === T);
    return { c, stakeOk, setOk, wins: c.winners, ok: c.result === c.n && c.win === c.n && c.mult === c.winners && c.pay === c.n && c.copies === c.n && c.answerDraw === c.n && c.answerPay === c.n && stakeOk && setOk && c.winners >= 100 };
  };
  const a = chk(pC, PHASE_C_STAKE, PHASE_C_TARGET_H), b = chk(pC10, PHASE_C10_STAKE, PHASE_C10_TARGET_H);
  const minE3 = u8(ex.minStake);   // E03 wallet.minBet, read at run time
  const minOk = minE3 !== null && units8(PHASE_C_STAKE) === 100n * minE3;
  record('LIMBO-12', a.ok && b.ok && minOk, `Phase C ${pC.bets.length} bets at target 1.98 at ${PHASE_C_STAKE} (= 100 × E03 minimum ${ex.minStake}: ${minOk}): results ${pct(a.c.result, a.c.n)}, multipliers ${pct(a.c.mult, a.c.winners)}, payouts ${pct(a.c.pay, a.c.n)}, stake as sent and settled ${a.stakeOk}, server answer == copy ${pct(Math.min(a.c.answerDraw, a.c.answerPay), a.c.n)}, ${a.wins} elevated wins (≥ 100); $10 set ${pC10.bets.length} bets at target 1.10 at ${PHASE_C10_STAKE}: results ${pct(b.c.result, b.c.n)}, multipliers ${pct(b.c.mult, b.c.winners)}, payouts ${pct(b.c.pay, b.c.n)}, stake ${b.stakeOk}, server answer == copy ${pct(Math.min(b.c.answerDraw, b.c.answerPay), b.c.n)}, ${b.wins} wins (≥ 100); same result function, win rule and payout rule as base stake`);
});

// ═══ LIMBO-14 target bounds & maximum payout. The profile's rule: every target on the declared precision within the declared
//      range; the result cap and the maximum-payout clip DECLARED (or declared undeclared); an advertised maximum target no
//      legal stake can play, or a client-side ceiling the server does not enforce, disclosed. A declared branch the capture
//      never produced (the max-win refusal; a target above the client-side ceiling) is declared unwitnessed in the detail and
//      in DL-10 and is not a violation of that rule, so it is a PASS, as another ProvablyFair.org limbo audit scores the same gap. ═══
step(['LIMBO-14'], () => {
  const all = ALL.flatMap((d) => d.bets);
  const onGrid = all.filter((b) => { const T = hund(b.setting.target); return Math.abs(b.setting.target * 100 - T) < 1e-6 && T >= MIN_TARGET_H && T <= MAX_TARGET_H; }).length;
  const min8 = u8(ex.minStake), maxWin8 = u8(ex.maxWin);   // E03 wallet.minBet / maxWin, read at run time
  const maxTargetPlayable = min8 !== null && maxWin8 !== null && payout8(min8, multiplier8(MAX_TARGET_H)) <= maxWin8;
  const playedMax = ds.bets.filter((b) => hund(b.setting.target) === MAX_TARGET_H).length;
  const maxPaid = all.reduce((m, b) => { const v = u8(b.payout); return v !== null && v > m ? v : m; }, 0n);
  const lim = readJson('evidence/E03-limbo-limits-2026-10-12.json').answer.body.wallet;
  const e2 = readJson('evidence/E02-limbo-rules-panel-2026-10-10.json');
  const capDeclared = typeof e2.rulesPanelEnglish?.rulesMaxWin === 'string' && /refused/.test(e2.rulesPanelEnglish.rulesMaxWin);
  const clampDeclared = /Math\.min\(eo,/.test(e2.functions?.['clampTarget (fa)'] ?? '');
  const reach8 = (units8(lim.maxBet) * multiplier8(MAX_TARGET_H)) / 100000000n;
  const f8 = (v: bigint) => (Number(v) / 1e8).toLocaleString('en', { maximumFractionDigits: 8 });
  const detail = `every chosen target on the 0.01× grid within [1.01×, 1,000,000×] (E02 bc, eo): ${pct(onGrid, all.length)}; result cap 1,000,000× declared (E01 max, E02 rulesCapLine, targets above it cannot be entered); maximum win ${ex.maxWin} USDT (E03 wallet.maxWin), a bet that would exceed it is refused, not reduced (E02 rulesMaxWin, declared: ${capDeclared}); max bet ${f8(units8(lim.maxBet))} USDT (E03 wallet) × 1,000,000× = ${f8(reach8)} > max win: ${maxWin8 !== null && reach8 > maxWin8} (the refusal is reachable within the bet limits); largest captured payout ${f8(maxPaid)} USDT; the advertised maximum target 1,000,000× is playable at the minimum stake (pays ${min8 === null ? '?' : Number(payout8(min8, multiplier8(MAX_TARGET_H))) / 1e8} ≤ cap: ${maxTargetPlayable}) and was played ${playedMax} times in Phase A; the target ceiling is client-side (E02 clampTarget, declared: ${clampDeclared})`;
  if (!(onGrid === all.length && maxTargetPlayable && playedMax > 0)) record('LIMBO-14', false, detail);
  else record('LIMBO-14', true, detail + '; declared unwitnessed (DL-10): no bet near the max-win cap was placed, so the refusal was never produced, and no target above the client-side ceiling was sent, so whether the server enforces it is not known');
});

// ═══ LIMBO-15 target coverage, against the capture plan in code (coverage is the auditor's: any shortfall is a capture FLAG) ═══
step(['LIMBO-15'], () => {
  const per: Record<string, number> = {}; for (const b of ds.bets) per[b.setting.cls] = (per[b.setting.cls] || 0) + 1;
  const under = PLAN_CLASSES.filter((c) => (per[c] || 0) < PLAN_CLASS_FLOOR);
  const decadeOf = (T: number) => (T < 1_000 ? 0 : T < 10_000 ? 1 : T < 100_000 ? 2 : T < 1_000_000 ? 3 : T < 10_000_000 ? 4 : T < 100_000_000 ? 5 : 6);
  const dec: Record<number, number> = {}; for (const b of ds.bets) { const k = decadeOf(hund(b.setting.target)); dec[k] = (dec[k] || 0) + 1; }
  const decShort = PLAN_DECADES.filter((k) => (dec[k] || 0) < DECADE_FLOOR);
  const minLegal = ds.bets.some((b) => hund(b.setting.target) === MIN_TARGET_H);
  const distinct = new Set(ds.bets.map((b) => hund(b.setting.target))).size;
  const aboveCap = ALL.flatMap((d) => d.bets).filter((b) => b.request.betNumber * 100 > MAX_TARGET_H).length;
  const fixedN = PLAN_CLASSES.filter((c) => c !== 'random').map((c) => per[c] || 0);
  const detail = `${PLAN_CLASSES.length} plan classes (src/loader.ts) each ≥ ${PLAN_CLASS_FLOOR} in Phase A: min ${Math.min(...PLAN_CLASSES.map((c) => per[c] || 0))} (random ${per['random'] || 0}; ${fixedN.length} fixed targets ${Math.min(...fixedN)}–${Math.max(...fixedN)} each)${under.length ? `, short: ${under.join(',')}` : ''}; target decades 1×…1,000,000× each ≥ ${DECADE_FLOOR}: ${PLAN_DECADES.map((k) => `${k === 6 ? '1e6' : '10^' + k}: ${dec[k] || 0}`).join(', ')}${decShort.length ? ` short: ${decShort.join(',')}` : ''}; minimum legal target 1.01× played: ${minLegal}; ${distinct} distinct targets; targets sent above the client-side ceiling 1,000,000×: ${aboveCap}`;
  // the one operator-side branch: a planned (declared-legal) target the server refused with anything but the transient
  // "Transaction temporarily unavailable" (the capture's meta.rejected; the transient ones are DL-1)
  const rej: any[] = asCaptured.meta.rejected ?? [];
  const transient = rej.filter((r) => r.status === 400 && r.body?.error === 'Transaction temporarily unavailable').length;
  const refused = rej.length - transient;
  const refusal = `; requests the server refused during Phase A: ${rej.length} (${transient} transient "Transaction temporarily unavailable", DL-1; ${refused} other)`;
  if (refused > 0) record('LIMBO-15', false, detail + refusal + ' — the server refused a planned target: operator-origin FLAG');
  // the profile asks for targets on both sides of a client-side cap where the operator has one (E02 clampTarget): not covered
  else captureFlag('LIMBO-15', detail + refusal + (under.length || decShort.length || !minLegal ? ' — the plan\'s coverage is short' : ' — the plan\'s classes, decades and minimum target are covered') + `; the profile's "targets on both sides of a client-side cap the server accepts" is not: no target above the ceiling was sent (DL-10). An auditor-side coverage shortfall: capture-origin FLAG, verdict-neutral`);
});

// ═══ LIMBO-16 wallet / balance reconciliation (the platform's bet history, E04; the account reconciliation, E05 = the full
//      output of the workshop's reconcile-full.py). E05 is checked by its numbers, not by the shape of its lines. ═══
step(['LIMBO-16'], () => {
  const e4 = readJson('evidence/E04-limbo-bet-history-2026-10-13.json'); const led = new Map<string, any>(e4.rows.map((r: any) => [r.id, r]));
  let n = 0, ok = 0;
  for (const d of ALL) for (const b of d.bets) {
    n++; const x = led.get(b.roundId);
    if (x && u8(b.stake) !== null && u8(b.payout) !== null && u8(x.stake) === u8(b.stake) && u8(x.payout) === u8(b.payout) && x.game === 'housegames-limbo' && x.status === (u8(b.payout)! > 0n ? 'won' : 'lost')) ok++;
  }
  const e5 = readFileSync(join(ROOT, 'evidence', 'E05-account-reconcile-2026-10-13.txt'), 'utf8');
  const D = '(-?\\d+(?:\\.\\d+)?)', S = '([+-]\\d+(?:\\.\\d+)?)';
  const rowRe = new RegExp(`^(\\S+\\.json)\\s+(\\d+)\\s+${D}\\s+${D}\\s+${S}$`, 'gm');
  const e5rows = [...e5.matchAll(rowRe)].map((m) => ({ f: m[1], k: Number(m[2]), st: u8(m[3]), pd: u8(m[4]), net: u8(m[5].replace(/^\+/, '')) }));
  const tot = new RegExp(`^TOTAL\\s+(\\d+)\\s+${D}\\s+${D}\\s+${S}$`, 'm').exec(e5);
  const totNet = tot ? tot[4].replace(/^\+/, '') : '0';
  const L = /^ledger: (\d+) entries = (\d+) captured rounds matched exactly \+ (\d+) open \+ (\d+) from 10 Oct; unexplained (\d+)$/m.exec(e5);
  const A = /^wallet cash balance after \(server, 8 dp\): (\d+\.\d{8})\s/m.exec(e5);
  const B = /^balance before = after - net (-?\d+\.\d+) \+ open stakes (\d+(?:\.\d+)?) = (\d+\.\d{8})$/m.exec(e5);
  const H = /--before (\d+\.\d{8})/.exec(e5.split('\n')[0] || '');
  const F = /^first answer of the day \S+: balance (\d+\.\d{4}) \(4 dp\) · last answer \S+: balance (\d+\.\d{4}) \(4 dp\)$/m.exec(e5);
  const rowsArith = e5rows.length > 0 && e5rows.every((r) => r.st !== null && r.pd !== null && r.net !== null && r.net === r.pd! - r.st!);
  const sum = (k: 'k' | 'st' | 'pd' | 'net') => e5rows.reduce((a, r) => a + BigInt(k === 'k' ? r.k : (r[k] as bigint) ?? 0n), 0n);
  const totOk = !!tot && BigInt(tot[1]) === sum('k') && u8(tot[2]) === sum('st') && u8(tot[3]) === sum('pd') && u8(totNet) === sum('net');
  const ledOk = !!L && !!tot && Number(L[2]) === Number(tot[1]) && Number(L[1]) === Number(L[2]) + Number(L[3]) + Number(L[4]) && Number(L[5]) === 0;
  const before8 = A && B && tot ? units8(A[1]) - units8(totNet) + units8(B[2]) : null;
  const balOk = !!A && !!B && !!H && !!tot && units8(B[1]) === units8(totNet) && before8 === units8(B[3]) && units8(B[3]) === units8(H[1]);
  const lastOk = !!F && !!A && Math.abs(Number(F[2]) - Number(A[1])) < 0.0001;
  const verdictLine = /^RECONCILED$/m.test(e5) && !/NOT RECONCILED/.test(e5);
  const asc = asCaptured as any as Dataset;
  const mine: [string, Dataset[]][] = [[E05_ROWS[0][0], [asc]], [E05_ROWS[1][0], [pC]], [E05_ROWS[2][0], [pD]], [E05_ROWS[3][0], [pC10]]];
  const mineN = mine.filter(([f, sets]) => {
    const r = e5rows.find((x) => x.f === f); let k = 0, st = 0n, pd = 0n, offGrid = 0;
    for (const d of sets) for (const b of d.bets) { k++; const s8 = u8(b._raw?.round?.stake), p8 = u8(b._raw?.round?.payout); if (s8 === null || p8 === null) offGrid++; else { st += s8; pd += p8; } }
    return !!r && offGrid === 0 && r.k === k && r.st === st && r.pd === pd && E05_ROWS.some(([ff, kk]) => ff === f && kk === k);
  }).length;
  const mineRounds = E05_ROWS.reduce((a, [, k]) => a + k, 0);
  const games = new Set(e5rows.map((r) => (r.f.match(/housebets-([a-z]+)/) || r.f.match(/\/(dice)-probe/) || [])[1]).filter(Boolean));
  const rec = rowsArith && totOk && ledOk && balOk && lastOk && verdictLine;
  record('LIMBO-16', ok === n && e4.rows.length === n && rec && mineN === E05_ROWS.length && games.size === 11, `every limbo round of the package is in the platform's bet history with the same stake, payout and won/lost status: ${pct(ok, n)} (E04, ${e4.rows.length} rows); E05 (the full reconcile-full.py output, ${e5rows.length} capture-file rows over ${games.size} games) checked by its numbers: every row's net == paid − staked ${rowsArith}; TOTAL == the sum of the rows (${tot ? tot[1] : '?'} rounds) ${totOk}; ledger entries ${L ? L[1] : '?'} == ${L ? L[2] : '?'} captured + ${L ? L[3] : '?'} open + ${L ? L[4] : '?'} from 10 Oct, captured == TOTAL rounds, 0 unexplained: ${ledOk}; this package's ${E05_ROWS.length} capture files (${mineRounds} rounds): rounds, staked and paid == the sums of the server's round records in the package's own datasets ${pct(mineN, E05_ROWS.length)}; balance before == wallet balance after ${A ? A[1] : '?'} − net ${tot ? tot[4] : '?'} + open stakes ${B ? B[2] : '?'} = ${before8 === null ? '?' : (Number(before8) / 1e8).toFixed(8)}, == the reconcile run's --before argument ${H ? H[1] : '?'}: ${balOk} (that argument is the figure the run was given; the page-header read it came from was not kept, disclosed DL-11); the last answer's 4-dp balance ${F ? F[2] : '?'} == the balance after to 4 dp: ${lastOk}; the exhibit ends RECONCILED: ${verdictLine}; the per-bet balance field is not used: 8 games were captured concurrently`);
});

// ═══ LIMBO-17 boundary semantics: tie, result floor and cap — witnessed by data ═══
step(['LIMBO-17'], () => {
  const all = ALL.flatMap((d) => d.bets);
  const ties = all.filter((b) => hund(b.outcome) === hund(b.setting.target));
  const tieOk = ties.filter((b) => b.payoutMultiplier > 0).length;
  const floors = all.filter((b) => hund(b.outcome) === MIN_RESULT_H);
  const floorLose = floors.filter((b) => b.payoutMultiplier === 0).length;
  const caps = all.filter((b) => hund(b.outcome) === MAX_RESULT_H).length;
  const capP = winningDraws(MAX_RESULT_H).count;
  const detail = `tie (result == target) wins, as published "at least your target (compared to the cent)": witnessed ${pct(tieOk, ties.length)} ties paid; result floor 1.00× (a point mass) loses at every legal target (≥ 1.01×): witnessed ${pct(floorLose, floors.length)} floor results lost; result cap 1,000,000×: ${caps} witnessed (a draw reaches it with probability ${capP}/2^32)`;
  // the profile's rule: each case witnessed by data (or by operator-verifier probes) with its count, and a case asserted from
  // source alone declared unwitnessed, never passed silently. A served settlement against the published rule is a FAIL; a case
  // with no witness is declared in the detail (and in DL-3), as another ProvablyFair.org limbo audit scores its unwitnessed cases.
  const unwitnessed = [ties.length === 0 ? 'tie' : '', floors.length === 0 ? 'floor' : '', caps === 0 ? 'cap' : ''].filter(Boolean);
  if (tieOk !== ties.length || floorLose !== floors.length) record('LIMBO-17', false, detail + ' — CONTRADICTED: a served settlement differs from the published rule');
  else record('LIMBO-17', true, detail + (unwitnessed.length ? `; declared unwitnessed (DL-3): ${unwitnessed.join(', ')}${caps === 0 ? ' — the cap is taken from E01/E02 and the formula (the limbo page\'s code calls /bet, /change_seed, /fairness, /limits, /seeds and /unhash, none of which returns a result without a bet)' : ''}` : ''));
});

// ═══ LIMBO-18 anti-circularity: win probability from the draw domain and the rule alone ═══
step(['LIMBO-18'], () => {
  const served = [...new Set(ALL.flatMap((d) => d.bets.map((b) => hund(b.setting.target))))].sort((a, b) => a - b);
  // an independent count: bisection over the whole domain for the first losing draw (no closed form used), as E02 wc does
  const bisect = (T: number) => { let lo = 0, hi = 4294967296; while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (resultFromU(mid) < T) hi = mid; else lo = mid + 1; } return lo; };
  let same = 0, within = 0;
  const pubNum = ex.winChanceNumerator === null ? NaN : ex.winChanceNumerator * TWO32;   // E02 rulesChanceFormula "99 ÷ target", read at run time
  for (const T of served) { const c = bisect(T); if (c === winningDraws(T).count) same++; if (Math.abs(c * T - pubNum) <= T) within++; }
  // negative control: a winner's served result moved down by one cent is caught by the recompute
  const copy = JSON.parse(JSON.stringify(ds)) as Dataset; const moved = copy.bets.find((b) => b.payoutMultiplier > 0)!;
  moved.outcome = (hund(moved.outcome) - 1) / 100; const neg = recompute(copy);
  const negOk = neg.result === neg.n - 1;
  record('LIMBO-18', same === served.length && within === served.length && negOk,
    `for each of the ${served.length} distinct served targets the winning-draw count found by bisection over all 2^32 draws equals the count the package uses: ${pct(same, served.length)}; and P(win) is at most 2^-32 from the published "Win chance = ${ex.winChanceNumerator ?? '?'} ÷ target, in percent" (E02, read at run time): ${pct(within, served.length)}; no operator win-chance field is read (LIMBO-13 only compares it); negative control: one served result moved by 0.01× is rejected (${pct(neg.n - neg.result, 1)} mismatch)`);
});

// ═══ LIMBO-19 effective edge across the legal target grid vs claim (RTP-CLAIM 1.2.0, exact; enforced) ═══
step(['LIMBO-19'], () => {
  const toF = (s: string) => { const [n, d] = s.split('/').map(BigInt); return Number(n * 10n ** 15n / d) / 1e15; };
  const lo = toF(rtp.trueMin.rtpExact), hi = toF(rtp.trueMax.rtpExact);
  const cl = ex.claimRtp === null ? NaN : Number(ex.claimRtp);
  // the step's own condition besides the rule: a figure was read from the exhibits. The rule and the table decide the rest.
  const ok = ex.claimRtp !== null;
  const places = ex.places.map((x) => `${x.place} (${x.exhibit} ${x.field.split('.').pop()}: ${x.rtp ?? 'no figure read'})`).join(', ');
  recordRtpClaim('LIMBO-19', ok, gate, `${rtp.settings.toLocaleString('en')} legal targets (every 0.01× from 1.01× to 1,000,000×), RTP = winning draws × the payout rule's multiplier (src/rules.ts multiplierH) over 2^32: derived RTP ${lo.toFixed(12)} (${rtp.trueMin.setting}) … ${hi.toFixed(12)} (${rtp.trueMax.setting}) vs the flat ${ex.claimRtp ?? '(none)'} claim, read from the pinned exhibits at run time at every place they state it: ${places}${ex.placesAgree ? '' : ' — the places differ, the highest is tested'}; ${rtp.trueMin.rtpExact === '99/100' && cl === 0.99 ? 'never below 99 % (the winning-draw count rounds up to the next whole draw), ' : ''}at most ${(hi - cl).toExponential(2)} above; ${rtp.houseSideFailures} house-side beyond the 0.1 pp band, ${rtp.playerFavourable} player-favourable beyond it → RTP-CLAIM ${rtp.outcome} (rule ${rtp.rule} ${rtp.ruleVersion.split(' ')[0]}, enforced ${RTP_CLAIM_RULE_ENFORCED}: ${ruleStatus}); committed table (outputs/rtp-claim-table.json) == this run's and its pin: ${gate.tableMatches} (a table that does not is a reproduction failure, FAIL, miss or no miss)`);
});

// ═══ LIMBO-20 / LIMBO-21 the simulation, re-run in full and compared with the pinned census ═══
/** '' when the pinned census ships; else the words the census checks print (and censusSame is false: FAIL). */
function censusMissing(): string { return existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? '' : ' (outputs/simulation-results.json is MISSING: the re-run has nothing to equal, FAIL)'; }
let cen: Census; let censusSame = false;
const p2sets = [{ set: 'A', ds }, { set: 'tail', ds: tail }, { set: 'C', ds: pC }, { set: 'C10', ds: pC10 }, { set: 'D', ds: pD }];   // an array of names: it cannot throw (not wrapped, so mutation M21c finds it)
step(['LIMBO-20'], () => {
  cen = census(p2sets);
  const committed = (existsSync(join(ROOT, 'outputs', 'simulation-results.json')) ? readFileSync(join(ROOT, 'outputs', 'simulation-results.json'), 'utf8') : null);
  censusSame = censusText(cen) === committed;
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'simulation-results.json'), censusText(cen));
});
step(['LIMBO-20'], () => {
  const p1 = cen.pass1; const exp = p1.draws / SIM_UNIFORMITY_BINS;
  const chi2 = p1.bins.reduce((s, o) => s + (o - exp) ** 2 / exp, 0), pChi = chiSquaredPValue(chi2, SIM_UNIFORMITY_BINS - 1);
  const n = p1.lag1.n, sx = Number(BigInt(p1.lag1.sumX)), sx2 = Number(BigInt(p1.lag1.sumX2)), sxy = Number(BigInt(p1.lag1.sumXY));
  const mean = sx / n, varr = sx2 / n - mean * mean, r1 = (sxy / (n - 1) - mean * mean) / varr, z1 = r1 * Math.sqrt(n), pLag = twoSidedNormalP(z1);
  const runs = runsStatisticFromCounts(p1.runs.runs, p1.runs.n1, p1.runs.n), pRuns = twoSidedNormalP(runs.z);
  const screens = pChi >= ALPHA_SCREEN && pLag >= ALPHA_SCREEN && pRuns >= ALPHA_SCREEN;
  const rowOf = (b: Census['bands'][number], size: number) => {
    const pw = b.winningDraws / 4294967296, m = b.targetH / 100, rtpE = (b.winningDraws * b.targetH) / (100 * 4294967296);
    const rtpS = (b.wins * m) / b.bets, se = Math.sqrt(pw * (1 - pw)) * m / Math.sqrt(b.bets), ok = Math.abs(rtpS - rtpE) <= EDGE_SIGMAS * se + EDGE_BUFFER && b.bets >= size;
    return { label: `${m}×`, rtpS, rtpE, se, width: EDGE_SIGMAS * se + EDGE_BUFFER, ok, fa: edgeBandFalseAlarm(b.bets, pw, m, rtpE).rate, wd: b.winningDraws === winningDraws(b.targetH).count };
  };
  const bandRows = cen.bands.map((b) => rowOf(b, SIM_EDGE_BETS)), tableRows = cen.table.map((b) => rowOf(b, SIM_TABLE_BETS)), longRow = rowOf(cen.long, SIM_LONG_BETS);
  // the three parts are the design's targets and nothing else, in order; the nine start at the smallest legal target
  const span = cen.bands.some((b) => b.targetH === MIN_TARGET_H) && SIM_EDGE_TARGETS_H.length === cen.bands.length && cen.bands.every((b, i) => b.targetH === SIM_EDGE_TARGETS_H[i])
    && cen.table.length === SIM_TABLE_TARGETS_H.length && cen.table.every((b, i) => b.targetH === SIM_TABLE_TARGETS_H[i]) && cen.long.targetH === SIM_LONG_TARGET_H;
  const depth = p1.draws === SIM_UNIFORMITY_DRAWS && p1.draws >= FLOOR_UNIFORMITY_DRAWS && cen.bands.length >= FLOOR_BANDS && cen.bands.every((b) => b.bets >= FLOOR_BAND_BETS)
    && cen.long.bets >= FLOOR_CONVERGENCE_BETS && cen.table.length >= FLOOR_EDGE_TABLE_TARGETS && cen.table.every((b) => b.bets >= FLOOR_EDGE_TABLE_BETS);
  const longMarks = cen.long.marks.map((k) => { const m = cen.long.targetH / 100, pw = cen.long.winningDraws / 4294967296; return `${k.n.toLocaleString('en')}: ${(k.wins * m / k.n * 100).toFixed(4)} % (SE ${(Math.sqrt(pw * (1 - pw)) * m / Math.sqrt(k.n) * 100).toFixed(4)} pp)`; });
  const allRows = [...bandRows, longRow, ...tableRows];
  const uFa = uniformityScreenFalseAlarm(SIM_UNIFORMITY_BINS, SIM_UNIFORMITY_BINS, p1.draws, ALPHA_SCREEN);
  const ok = censusSame && screens && allRows.every((b) => b.ok && b.wd) && span && depth;
  record('LIMBO-20', ok, `census re-run in full == the pinned outputs/simulation-results.json byte for byte: ${censusSame}${censusMissing()}; ${p1.draws.toLocaleString('en')} fresh draws u: chi² ${chi2.toFixed(2)} (df ${SIM_UNIFORMITY_BINS - 1}, 128 bins of exactly 2^25 values) p ${pChi.toFixed(4)}, lag-1 r ${r1.toExponential(2)} z ${z1.toFixed(3)} p ${pLag.toFixed(4)}, runs z ${runs.z.toFixed(3)} p ${pRuns.toFixed(4)} (each ≥ α/3 = ${ALPHA_SCREEN.toFixed(4)}: ${screens}); ${bandRows.filter((b) => b.ok).length}/${bandRows.length} targets of ${SIM_EDGE_BETS.toLocaleString('en')} bets within 5·SE + 1e-4 of the exact RTP (1.01× … 10,000×, the design's set, each on its own seeds: ${span}); worst |Δ|/SE ${Math.max(...bandRows.map((b) => Math.abs(b.rtpS - b.rtpE) / b.se)).toFixed(2)}; tolerance |RTP_sim − RTP_exact| ≤ ${EDGE_SIGMAS}·SE + ${EDGE_BUFFER}, SE = σ/√n, per target |Δ| vs width: ${bandRows.map((b) => `${b.label} ${Math.abs(b.rtpS - b.rtpE).toFixed(5)} ≤ ${b.width.toFixed(5)}`).join('; ')}; the long run of ${cen.long.bets.toLocaleString('en')} bets at ${longRow.label}: simulated RTP ${(longRow.rtpS * 100).toFixed(4)} % vs exact ${(longRow.rtpE * 100).toFixed(4)} %, |Δ| ${Math.abs(longRow.rtpS - longRow.rtpE).toFixed(6)} ≤ ${longRow.width.toFixed(6)} (SE ${longRow.se.toExponential(3)}, |Δ|/SE ${(Math.abs(longRow.rtpS - longRow.rtpE) / longRow.se).toFixed(2)}): ${longRow.ok}; its running RTP at ${longMarks.join(', ')}; the edge table, ${tableRows.filter((b) => b.ok).length}/${tableRows.length} targets of ${SIM_TABLE_BETS.toLocaleString('en')} bets within tolerance, worst |Δ|/SE ${Math.max(...tableRows.map((b) => Math.abs(b.rtpS - b.rtpE) / b.se)).toFixed(2)}, per target |Δ| vs width: ${tableRows.map((b) => `${b.label} ${Math.abs(b.rtpS - b.rtpE).toFixed(5)} ≤ ${b.width.toFixed(5)}`).join('; ')}; rows whose width exceeds the ${HOUSE_EDGE * 100} % house edge, so that row alone cannot detect an edge of that size: of the ${SIM_EDGE_BETS.toLocaleString('en')}-bet targets ${bandRows.filter((b) => b.width > HOUSE_EDGE).map((b) => b.label).join(', ') || 'none'}; of the ${SIM_TABLE_BETS.toLocaleString('en')}-bet targets ${tableRows.filter((b) => b.width > HOUSE_EDGE).map((b) => b.label).join(', ') || 'none'}; the long run's width is ${longRow.width.toFixed(6)}; false-alarm rates: uniformity ${fmtRate(uFa.rate)}, worst row ${fmtRate(Math.max(...allRows.map((b) => b.fa)))}, any row ${fmtRate(allRows.reduce((a, b) => a + b.fa, 0))}`);
});
step(['LIMBO-21'], () => {
  const ep = cen.pass2.epochs;
  const W = (w: any, k: 'scored' | 'all') => k === 'scored' ? [BigInt(w.scoredRet8), BigInt(w.scoredMean), BigInt(w.scoredVar), w.scoredBets] : [BigInt(w.ret8), BigInt(w.mean), BigInt(w.var), w.bets];
  const agg = (win: 'early' | 'ref', k: 'scored' | 'all') => { let R = 0n, M = 0n, V = 0n, n = 0; for (const e of ep) { const [r, m, v, b] = W(e[win], k); R += r as bigint; M += m as bigint; V += v as bigint; n += b as number; }
    const mean = Number(M) / 4294967296, sd = Math.sqrt(Number(V)) / 4294967296, z = (Number(R) - mean) / sd; return { z, p: normalLowerTailP(z), n, sd8: sd }; };
  const early = agg('early', 'scored'), all = agg('early', 'all'), ref = agg('ref', 'scored');
  const below = ep.filter((e) => Number(BigInt(e.early.scoredRet8)) < Number(BigInt(e.early.scoredMean)) / 4294967296).length;
  // the SCORED statistic is the per-slot standardised return (the roulette/keno form, since 14 Oct 2026), re-derived from the
  // census's per-target counts and the datasets' own targets; the pooled form scored until 14 Oct is printed with its p-value
  const playedOf = new Map<string, number[]>(); const capturedOf = new Map<string, number[]>();
  for (const { set, ds: d } of p2sets) for (const sd of d.seeds) { const e = Number(sd.epoch); const inE = d.bets.filter((b) => b.epoch === e).sort((a, b) => a.nonce - b.nonce); playedOf.set(`${set}/${e}`, inE.map((b) => hund(b.setting.target))); capturedOf.set(`${set}/${e}`, inE.map((b) => b.nonce)); }
  let slotSums = true;
  const perSlot = (win: 'early' | 'ref', scoredOnly: boolean, only?: (e: typeof ep[number]) => boolean) => {
    let zs = 0, n = 0, inv = 0;
    for (const x of ep) {
      if (only && !only(x)) continue;
      const Ts = playedOf.get(`${x.set}/${x.epoch}`), w = x[win] as any; if (!Ts || !w.slotBets || w.slotBets.length !== Ts.length) { slotSums = false; continue; }
      let r8 = 0n, nb = 0;
      for (let j = 0; j < Ts.length; j++) {
        r8 += BigInt(w.slotWins[j]) * multiplier8(Ts[j]); nb += w.slotBets[j];
        if (scoredOnly && Ts[j] > SIM_PASS2_MAX_TARGET_H) continue;
        const q = winningDraws(Ts[j]).count / 4294967296, sdq = Math.sqrt(q * (1 - q));
        zs += (w.slotWins[j] - w.slotBets[j] * q) / sdq; n += w.slotBets[j]; inv += w.slotBets[j] / (Ts[j] / 100 * sdq);
      }
      if (r8 !== BigInt(w.ret8) || nb !== w.bets) slotSums = false;
    }
    const z = zs / Math.sqrt(n); return { z, p: normalLowerTailP(z), n, inv };
  };
  const sEarly = perSlot('early', true), sAll = perSlot('early', false), sRef = perSlot('ref', true);
  // the early window is the capture itself: its all-slot return must equal the sum of the served multipliers of every bet
  let served = 0n; for (const { ds: d } of p2sets) for (const b of d.bets) served += u8(b.payoutMultiplier) ?? -1n;
  const earlyAll = ep.reduce((s, e) => s + BigInt(e.early.ret8), 0n);
  const zPow = -normalQuantile(SIM_PASS2_ALPHA) + normalQuantile(0.8);
  const deficitPp = (zPow * early.sd8 / 1e8) / early.n * 100;
  // a uniform per-bet RTP deficit d shifts every slot's return by d, so the per-slot z moves by d × Σ(1/sd)/√slots
  const deficitSlotPp = zPow * Math.sqrt(sEarly.n) / sEarly.inv * 100, deficitSlotAllPp = zPow * Math.sqrt(sAll.n) / sAll.inv * 100;
  // every revealed seed of the five files, each epoch's early window == its captured nonces 1..n
  const seedsExpected = EXPECTED_SEEDS + tail.seeds.length + EXPECTED_PHASE_C_BETS / EXPECTED_EPOCH_SIZE + EXPECTED_PHASE_C10_BETS / EXPECTED_EPOCH_SIZE + EXPECTED_PHASE_D_BETS / EXPECTED_EPOCH_SIZE;
  const revealed = p2sets.reduce((a, { ds: d }) => a + d.seeds.filter((s) => typeof s.revealedServerSeed === 'string' && s.revealedServerSeed.length === 64).length, 0);
  const windowsOk = ep.every((e) => { const ns = capturedOf.get(`${e.set}/${e.epoch}`); return !!ns && ns.length === e.depth && ns.every((x, i) => x === NONCE_BASE + i) && e.early.bets === e.depth && e.early.bets + e.ref.bets === SIM_PASS2_NONCES; });
  const depthOk = ep.length === seedsExpected && ep.length === revealed && SIM_PASS2_NONCES >= FLOOR_PASS2_NONCES && windowsOk;
  const sA = perSlot('early', true, (e) => e.set === 'A'), sRest = perSlot('early', true, (e) => e.set !== 'A');
  const bySet = ['A', 'tail', 'C', 'C10', 'D'].map((s) => `${s === 'C10' ? 'C $10' : s} ${ep.filter((e) => e.set === s).length}`).join(', ');
  const FA = PASS2_FALSE_ALARM;
  const ok = censusSame && depthOk && served === earlyAll && slotSums && sEarly.p >= SIM_PASS2_ALPHA && FA.perSlotRate <= FAIL_FALSE_ALARM_CAP;
  record('LIMBO-21', ok, `${censusMissing() ? `census${censusMissing()}; ` : ''}${ep.length} revealed epochs (every revealed seed of the five bet files: ${bySet}; == the population constants and the revealed seeds: ${ep.length === seedsExpected && ep.length === revealed}) × ${SIM_PASS2_NONCES.toLocaleString('en')} nonces (early = 1..n, n = the epoch's captured depth, 50, the tail 30; reference = n+1..${SIM_PASS2_NONCES}; every early window == the epoch's captured nonces: ${windowsOk}); scored statistic (since 14 Oct 2026, the roulette/keno form): the per-slot standardised early-window return of the ${sEarly.n} scored played slots (target ≤ ${SIM_PASS2_MAX_TARGET_H / 100}×, src/sim-config.ts) z ${sEarly.z.toFixed(3)}, one-sided p ${sEarly.p.toFixed(4)} (≥ ${SIM_PASS2_ALPHA}: ${sEarly.p >= SIM_PASS2_ALPHA}); printed, not scored: the Phase A epochs alone z ${sA.z.toFixed(3)} (${sA.n} slots), the other ${ep.filter((e) => e.set !== 'A').length} z ${sRest.z.toFixed(3)} (${sRest.n} slots); reference window z ${sRef.z.toFixed(3)}; all ${sAll.n} slots z ${sAll.z.toFixed(3)} p ${sAll.p.toFixed(4)} (printed, not scored; ${sAll.n - sEarly.n} played slots above ${SIM_PASS2_MAX_TARGET_H / 100}× are unscored); the switch from the pooled form was made after the pooled result was known: pooled (scored until 14 Oct, printed) z ${early.z.toFixed(3)}, p ${early.p.toFixed(4)}, reference z ${ref.z.toFixed(3)}, all slots z ${all.z.toFixed(3)}; per-target census counts == the window totals: ${slotSums}; ${below} epochs below expectation, ${ep.length - below} at or above (descriptive, not a test: under fair play ${FA.belowMean} ± ${FA.belowSd} of ${ep.length} are below, because the return is right-skewed; src/false-alarm-pass2.ts); early window == the captured served multipliers: ${served === earlyAll}; detection power of the scored statistic: a ${deficitSlotPp.toFixed(2)} pp per-bet RTP deficit at 80 % (on all slots ${deficitSlotAllPp.toFixed(2)} pp; pooled form ${deficitPp.toFixed(2)} pp); false-alarm rate of the scored rule ${FA.perSlotRate} ± ${FA.perSlotStandardError} (pooled rule ${FA.rate} ± ${FA.standardError}; declared in src/false-alarm-pass2.ts from ${FA.replicates.toLocaleString('en')} honest replicates and re-derived by npm run false-alarm:pass2, not re-run by verify; ≤ ${FAIL_FALSE_ALARM_CAP})`);
});

// ═══ LIMBO-22 live-sample fit (INFORMATIONAL) ═══
step(['LIMBO-22'], () => {
  const Rs = ds.bets.map((b) => hund(b.outcome));
  const floorN = Rs.filter((R) => R === MIN_RESULT_H).length, floorP = 1 - winningDraws(101).count / 4294967296;
  const cont = Rs.filter((R) => R >= 101);
  // continuous part: P(R ≥ x | R ≥ 1.01) = 1.01 / x, so 1 − 101/R is ≈ uniform (the 0.01× lattice makes it a step function)
  const kst = ksTest(cont.map((R) => 1 - 101 / R), (x) => Math.min(1, Math.max(0, x)));
  const order = [...ds.bets].sort((a, b) => a.idx - b.idx).map((b) => Math.log(hund(b.outcome)));
  const r1 = lagOneAutocorrelation(order), runs = waldsWolfowitzRunsTest(order);
  const zFloor = (floorN - floorP * Rs.length) / Math.sqrt(floorP * (1 - floorP) * Rs.length);
  record('LIMBO-22', true, `${Rs.length} captured results: point mass at 1.00× ${floorN} vs expected ${(floorP * Rs.length).toFixed(1)} (z ${zFloor.toFixed(2)}); continuous part (${cont.length}) KS D ${kst.ks.toFixed(5)} p ${kst.pValue.toFixed(4)} against P(R ≥ x) = 0.99/x; lag-1 r ${r1.toFixed(5)}; runs z ${runs.zScore.toFixed(3)} p ${runs.pValue.toFixed(4)} — informational (a ${Rs.length}-round sample has little power and never bears the verdict)`);
});

// ═══ LIMBO-31 scaling edge: declared absent — confirmed from the published spec and every bet's applied edge ═══
step(['LIMBO-31'], () => {
  const e1 = readJson('evidence/E01-limbo-fairness-spec-2026-10-12.json').answer.body;
  // one flat houseEdge figure and no scaling, tier or exposure block (E01 `scale` = 100 is the result lattice). The figure itself is
  // a claim (the game settings, LIMBO-19), never compared here: a raised figure is an RTP miss, not a scaling edge
  const noScaling = typeof e1.houseEdge === 'number' && !Object.keys(e1).some((k) => /scaling|tier|exposure|edgeTable/i.test(k));
  const winners = ALL.flatMap((d) => d.bets).filter((b) => b.payoutMultiplier > 0);
  const flat = winners.filter((b) => u8(b.payoutMultiplier) === multiplier8(hund(b.setting.target))).length;
  const stakes = [...new Set(ALL.flatMap((d) => d.bets).map((b) => String(b.stake)))];
  record('LIMBO-31', noScaling && flat === winners.length, `no scaling edge: the published spec (E01) carries one flat houseEdge figure and no scaling, tier or exposure block (${noScaling}); the edge applied to every bet is the result formula's 0.99 numerator, and every winner across the stakes ${stakes.join(', ')} was paid exactly its target: ${pct(flat, winners.length)} — the applied edge equals the flat edge on every bet`);
});

// ═══ Package checks: LIMBO-23, 24, 25, 27, 28, 29, 30 ═══
const manifest = input('manifest', () => (manifestText));
const readme = input('readme', () => (existsSync(join(ROOT, 'README.md')) ? readFileSync(join(ROOT, 'README.md'), 'utf8') : ''));
step(['LIMBO-23'], () => {
  // the framework's standardized S5 matrix: ids S5-1 … S5-8 AND their names, in order, between the S5-MATRIX markers, each
  // row with a status. The names are the framework's; when the vendored profile's -23
  // rule lists them, that list is used and must equal this one.
  const S5_NAMES = ['Replay protection', 'Input validation', 'Seed integrity under adversarial input', 'Cross-player isolation',
    'Payout field integrity', 'Nonce sequence enforcement', 'Parameter boundary enforcement', 'Game-specific state'];
  let asserts = ''; try { asserts = String(JSON.parse(readFileSync(join(ROOT, 'profile', 'profile.json'), 'utf8')).checks.find((c: any) => c.id === 'LIMBO-23')?.asserts ?? ''); } catch { asserts = ''; }
  const listed = (/S5-1\s*…\s*S5-8\s*\(([^)]*)\)/.exec(asserts)?.[1] ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const profileAgrees = listed.length === 0 || (listed.length === 8 && listed.every((x, i) => x.toLowerCase() === S5_NAMES[i].toLowerCase()));
  const block = /<!-- S5-MATRIX:BEGIN -->([\s\S]*?)<!-- S5-MATRIX:END -->/.exec(manifest)?.[1] ?? '';
  const rowsS5 = block.split('\n').filter((l) => /^\| S5-\d+ \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  const header = block.split('\n').find((l) => /^\| Test ID \|/.test(l))?.split('|').slice(1, -1).map((c) => c.trim()) ?? [];
  const resCol = header.indexOf('Result');
  const good = rowsS5.filter((r, i) => r[0] === `S5-${i + 1}` && (r[1] ?? '').toLowerCase() === (S5_NAMES[i] ?? '').toLowerCase() && resCol > 0 && /^(Pass|Flag|Hard Fail|Not tested)\b/.test(r[resCol] ?? ''));
  const ok = rowsS5.length === 8 && good.length === 8 && header[1] === 'Category' && profileAgrees;
  const bad = rowsS5.map((r) => (good.includes(r) ? null : `${r[0]} "${r[1]}"`)).filter(Boolean);
  // the printed tally separates a row that passes on every control it names from one that passes on part of them and from
  // one that is Not tested (a status that starts "Pass on" is a partial pass)
  const s5cov = (st: string[]) => { const full = st.filter((s) => /^Pass\b/.test(s) && !/^Pass on\b/.test(s)).length, part = st.filter((s) => /^Pass on\b/.test(s)).length, nt = st.filter((s) => /^Not tested\b/.test(s)).length, fl = st.filter((s) => /^Flag\b/.test(s)).length, hf = st.filter((s) => /^Hard Fail\b/.test(s)).length;
    return `${full} Pass on every control the row names, ${part} Pass on part of the controls it names, ${nt} Not tested${fl ? `, ${fl} Flag` : ''}${hf ? `, ${hf} Hard Fail` : ''}`; };
  record('LIMBO-23', ok, `MANIFEST.md S5 fairness-integrity matrix (between the S5-MATRIX markers): ${good.length}/8 rows carry the framework's id and name in order (${S5_NAMES.map((x, i) => `S5-${i + 1} ${x}`).join(', ')}) and a status (${s5cov(rowsS5.map((r) => r[resCol] ?? ''))}); columns ${header.join(' | ') || 'none'}; the profile's -23 rule ${listed.length ? `lists the names, equal: ${profileAgrees}` : 'does not list the names (the framework list above is used)'}${bad.length ? `; rows that differ: ${bad.join(', ')}` : ''}${rowsS5.length !== 8 ? `; ${rowsS5.length} rows` : ''}`);
});
// -24: the site-verifier module (site-verifier/derive.js, generated from src/rng.ts by scripts/build-site-verifier.mjs).
// Two legs, both needed. The pins: the file on disk has the sha256 of SITE_VERIFIER_PIN (src/artifact-pins.ts) and of its
// RELEASE-MANIFEST.json entry, and MANIFEST.md and README.md quote that sha256. The replay: the module is loaded from that
// file (never bundled into verify.js), must export what src/rng.ts exports, and every function is run side by side with
// src/rng.ts on every captured round of the five shipped datasets (boundaryDraw and winningDraws take a target, not a round:
// they are called with each captured bet's own target); one differing result fails the check. The pins alone would pass a
// module that derives something else and was re-pinned; the replay alone would pass a file nobody pinned.
const SITE = await loadSiteModule(ROOT, SITE_VERIFIER_PIN[0]);
step(['LIMBO-24'], () => {
  const [file, pin] = SITE_VERIFIER_PIN;
  const relPin: string | null = (() => { try { return readJson('RELEASE-MANIFEST.json').files?.[file] ?? null; } catch { return null; } })();
  const pinOk = SITE.sha256 !== null && SITE.sha256 === pin, relOk = SITE.sha256 !== null && SITE.sha256 === relPin;
  const cited = SITE.sha256 !== null && manifest.includes(SITE.sha256) && readme.includes(SITE.sha256);
  const names = exportNames(RNG), exportsOk = !!SITE.mod && JSON.stringify(exportNames(SITE.mod)) === JSON.stringify(names);
  function* probes(): Generator<Probe> {
    for (const d of ALL) {
      for (const s of d.seeds) if (s.revealedServerSeed) yield ['sha256Hex', (m) => m.sha256Hex(s.revealedServerSeed)];
      for (const b of d.bets) {
        const s = seedOf(d, b.epoch)!; const T = hund(b.setting.target);
        const u = RNG.drawU(s.revealedServerSeed, s.clientSeed, b.nonce);
        yield ['hmacBlock', (m) => m.hmacBlock(s.revealedServerSeed, s.clientSeed, b.nonce, 0)];
        yield ['drawU', (m) => m.drawU(s.revealedServerSeed, s.clientSeed, b.nonce)];
        yield ['resultFromU', (m) => m.resultFromU(u)];
        yield ['resultExactH', (m) => m.resultExactH(u)];
        yield ['resultHundredths', (m) => m.resultHundredths(s.revealedServerSeed, s.clientSeed, b.nonce)];
        yield ['boundaryDraw', (m) => m.boundaryDraw(T)];
        yield ['winningDraws', (m) => m.winningDraws(T)];
      }
    }
  }
  const rounds = ALL.reduce((n, d) => n + d.bets.length, 0);
  const rp = exportsOk ? replay(RNG, SITE.mod!, probes()) : null;
  const covered = rp ? names.filter((n) => rp.byLabel[n] > 0).length : 0;
  const replayOk = !!rp && rp.differences === 0 && rp.byLabel.resultHundredths === rounds && rounds === EXPECTED_BETS + EXPECTED_TAIL_BETS + EXPECTED_PHASE_C_BETS + EXPECTED_PHASE_C10_BETS + EXPECTED_PHASE_D_BETS && covered === names.length;
  record('LIMBO-24', pinOk && relOk && cited && exportsOk && replayOk, `${file} (generated from src/rng.ts by scripts/build-site-verifier.mjs): ${SITE.sha256 === null ? 'missing' : `sha256 ${SITE.sha256}`}; == SITE_VERIFIER_PIN in src/artifact-pins.ts: ${pinOk}; == its RELEASE-MANIFEST.json pin: ${relOk}; quoted in MANIFEST.md and README.md: ${cited}; ${SITE.mod ? `the module loaded from that file exports what src/rng.ts exports (${names.join(', ')}): ${exportsOk}` : `the module did not load (${SITE.error})`}; ${rp ? `run side by side with src/rng.ts on every captured round of the ${ALL.length} shipped datasets: ${rounds} rounds, ${rp.calls} calls (${Object.entries(rp.byLabel).map(([k, v]) => `${k} ${v}`).join(', ')}; ${covered}/${names.length} exports exercised), ${rp.differences} differing result${rp.differences === 1 ? '' : 's'}${rp.first ? ` (first: ${rp.first})` : ''}` : 'not replayed'}`);
});
step(['LIMBO-25'], () => {
  const need = ['Verify a bet', 'rotate', 'sha256', 'HMAC-SHA256', 'floor(', 'UTF-8', 'not the 32 bytes'];
  const has = need.filter((w) => readme.includes(w));
  record('LIMBO-25', has.length === need.length, `README.md "Verify a bet" carries where the seed is revealed, the fields, the commitment encoding, the HMAC key's encoding (the seed's text as UTF-8, not the 32 bytes it hex-decodes to) and the result formula: ${has.length}/${need.length} markers`);
});
const artifactBad = input('artifactBad', () => (ARTIFACT_PINS.filter(([f, h]) => !existsSync(join(ROOT, f)) || sha256File(f) !== h)));
/** the digest of the sources the standalone verify.js is built from (tests/verify.ts + src/*.ts, sorted by path:
 *  sha256 of "path\nsha256(bytes)\n" per file). scripts/build-standalone.mjs writes it into verify.js's header. */
function sourcesSha256(): string {
  const files = ['tests/verify.ts', ...readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.ts')).map((f) => `src/${f}`)].sort();
  return sha256Bytes(files.map((f) => `${f}\n${sha256Bytes(readFileSync(join(ROOT, f)))}\n`).join(''));
}
const SOURCES_SHA256 = input('SOURCES_SHA256', () => (sourcesSha256()));
const bundleSrc = input('bundleSrc', () => (existsSync(join(ROOT, 'verify.js')) ? (readFileSync(join(ROOT, 'verify.js'), 'utf8').match(/Sources sha256 \(tests\/verify\.ts \+ src\/\*\.ts\): ([0-9a-f]{64})/) || [])[1] ?? null : null));
const bundleFresh = input('bundleFresh', () => (bundleSrc === SOURCES_SHA256), false);
/** a gate record (outputs/mutation-results.json, outputs/fresh-copy.json) is read only when it ships pinned in
 *  RELEASE-MANIFEST.json and was produced from the sources this run uses; anything else is refused. */
const releasePins: Record<string, string> = input('releasePins', () => (existsSync(join(ROOT, 'RELEASE-MANIFEST.json')) ? (readJson('RELEASE-MANIFEST.json').files ?? {}) : {}));
function gateRecord(rel: string, script: string): { rec: any; why: string } {
  if (!existsSync(join(ROOT, rel))) return { rec: null, why: `${rel} is not in this copy` };
  if (releasePins[rel] !== sha256Bytes(readFileSync(join(ROOT, rel)))) return { rec: null, why: `${rel} is not the file pinned in RELEASE-MANIFEST.json` };
  const rec = readJson(rel);
  if (rec.sourcesSha256 !== SOURCES_SHA256) return { rec: null, why: `${rel} was produced from other sources (stale)` };
  // the record is also bound to the script that wrote it (an edited script could write a self-consistent record)
  const sp = join(ROOT, script);
  if (!existsSync(sp) || rec.scriptSha256 !== sha256Bytes(readFileSync(sp))) return { rec: null, why: `${rel} was not written by the ${script} in this copy` };
  return { rec, why: '' };
}
step(['LIMBO-28'], () => {
  const { rec: fc, why } = gateRecord('outputs/fresh-copy.json', 'scripts/fresh-copy-check.mjs');
  const clean = !!fc && fc.exit === 0 && fc.rngTestsExit === 0 && fc.standaloneExit === 0 && fc.cleanVerdict === true && fc.reproduced === true && fc.beyondTolerance === 0 && fc.pinnedUnchanged === true && fc.verifyJsSha256 === sha256Bytes(readFileSync(join(ROOT, 'verify.js')));
  record('LIMBO-28', clean && AUDIT_ID !== null, fc ? `committed fresh-copy record (outputs/fresh-copy.json, pinned in RELEASE-MANIFEST.json, produced by npm run gate:fresh from these sources on Node ${fc.node}): test exit ${fc.exit}, standalone exit ${fc.standaloneExit}, clean verdict ${fc.cleanVerdict}, REPRODUCED ${fc.reproduced}, regeneration vs committed ${fc.beyondTolerance} fields beyond tolerance, pinned artifacts unchanged ${fc.pinnedUnchanged}; audit ID ${AUDIT_ID ?? 'NOT ASSIGNED (pending, assigned by ProvablyFair.org)'}` : `no usable fresh-copy record: ${why}; audit ID ${AUDIT_ID ?? 'not assigned (pending, assigned by ProvablyFair.org)'}`);
  if (!fc && /is not in this copy|is not the file pinned/.test(why)) pinFail('LIMBO-28', why);   // missing or edited: FAIL, verdict-bearing (a stale record stays a GAP)
});
step(['LIMBO-29'], () => {
  const { rec: mr, why } = gateRecord('outputs/mutation-results.json', 'scripts/mutate.mjs');
  let consistent = false, detail = `no usable mutation record: ${why}`;
  if (mr) {
    const reg = readJson('tests/mutations.json').mutations as any[];
    const scoredIds = EXPECTED_STEPS;
    const res = Array.isArray(mr.results) ? mr.results : [];
    const idsMatch = res.length === reg.length && res.every((r: any, i: number) => r.id === reg[i].id && r.kills === reg[i].kills);
    // a mutation that names the exit it must end in (an RTP miss with table and record regenerated → 5, unregenerated → 1;
    // a missing step → 3) is killed only with that exit
    const exitOk = (r: any, m: any) => m.expectExit === undefined || ([] as number[]).concat(m.expectExit).includes(r.exit);
    const killedOk = res.every((r: any, i: number) => r.killed === (r.status !== r.baseline && r.status !== 'MISSING' && r.status !== 'ERROR' && exitOk(r, reg[i])));
    const nExit = reg.filter((m: any) => m.expectExit !== undefined).length;
    const nKilled = res.filter((r: any) => r.killed).length;
    const uncovered = scoredIds.filter((id) => !res.some((r: any) => r.kills === id && r.killed));
    consistent = mr.registrySha256 === sha256Bytes(readFileSync(join(ROOT, 'tests', 'mutations.json'))) && idsMatch && killedOk && mr.total === reg.length && mr.killed === nKilled && mr.control?.ok === true
      && JSON.stringify(mr.uncoveredSteps) === JSON.stringify(uncovered);
    detail = `committed mutation record (outputs/mutation-results.json, pinned in RELEASE-MANIFEST.json, produced by npm run mutate from these sources and tests/mutations.json): ${nKilled}/${reg.length} mutations killed by their named step, recounted from its rows (${nExit} of them also held to the exit code they must end in: an RTP miss with the table and record regenerated 5, the same change unregenerated 1, a missing step 3); record consistent with the registry and its own rows: ${consistent}; unmutated control copy == the committed statuses: ${mr.control?.ok}; undeclared survivors ${res.filter((r: any) => !r.killed).length}; scored steps with no killing mutation: ${uncovered.join(', ') || 'none'}`;
    consistent = consistent && res.every((r: any) => r.killed) && uncovered.length === 0;
  }
  record('LIMBO-29', consistent, detail);
  if (!mr && /is not in this copy|is not the file pinned/.test(why)) pinFail('LIMBO-29', why);   // missing or edited: FAIL, verdict-bearing (a stale record stays a GAP)
});
step(['LIMBO-30'], () => {
  const dl = (manifest.match(/^\| DL-\d+ \|/gm) || []).length;
  const prem = /Could the data contradict it\?/.test(manifest);
  const ev = EVIDENCE_PINS.every(([f]) => manifest.includes(f.split('/').pop()!));
  record('LIMBO-30', dl > 0 && prem && ev, `MANIFEST.md: ${dl} declared-limitation rows; load-bearing premises with "Could the data contradict it?": ${prem}; every exhibit E01…E${String(EVIDENCE_PINS.length).padStart(2, '0')} listed by file name: ${ev}`);
});

// LIMBO-27 runs last, after every check the committed record holds has its row, so its comparison sees the whole record
step(['LIMBO-27'], () => {
  const gi = existsSync(join(ROOT, '.gitignore')) ? readFileSync(join(ROOT, '.gitignore'), 'utf8') : '';
  const unignored = ARTIFACT_PINS.every(([f]) => gi.includes('!' + f));
  const noMeta = ARTIFACT_PINS.every(([f]) => existsSync(join(ROOT, f)) && !/"(runAt|generatedAt|timestamp|hostname|nodeVersion)"/.test(readFileSync(join(ROOT, f), 'utf8')));
  const cf = join(ROOT, 'outputs', 'verification-results.json');
  const recDiffs = existsSync(cf) ? beyondTolerance(fieldDiff(JSON.parse(readFileSync(cf, 'utf8')), recordOf())).length : -1;
  record('LIMBO-27', artifactBad.length === 0 && unignored && noMeta && censusSame && gate.tableMatches && recDiffs === 0 && bundleFresh,
    `${ARTIFACT_PINS.length - artifactBad.length}/${ARTIFACT_PINS.length} artifacts match the sha256 pinned in src/artifact-pins.ts${artifactBad.length ? ` (mismatch: ${artifactBad.map(([f]) => f).join(', ')})` : ''}; un-ignored by name in .gitignore: ${unignored}; no run metadata: ${noMeta}; census regenerated == committed: ${censusSame}${censusMissing()}; RTP table regenerated == committed: ${gate.tableMatches}; committed verification record == this run's: ${recDiffs === 0}${recDiffs > 0 ? ` (${recDiffs} fields differ)` : recDiffs < 0 ? ' (not recorded)' : ''}; the standalone verify.js was built from these sources (its header digest == tests/verify.ts + src/*.ts): ${bundleFresh}; verify writes only outputs/run/`);
});

finish();

/** the verdict from the scored rows, bound to the profile's scored list. A scored check with no status from this run
 *  (or recorded twice) withholds it: INCOMPLETE, exit 3. A FAIL still reads NOT PROVABLY FAIR (framework core/verdict.ts).
 *  No path that has a FAIL or a missing step can reach the Full Pass line. */
function verdictOf(scored: Row[], expected: readonly string[], extra = 0) {   // extra: FAILs outside the scored rows and run errors (extraFails())
  const seen = new Map<string, number>(); for (const r of scored) seen.set(r.id, (seen.get(r.id) || 0) + 1);
  const missing = expected.filter((id) => !seen.has(id));
  const duplicated = [...seen.entries()].filter(([, k]) => k > 1).map(([id]) => id);
  const ran = scored.filter((r) => r.status !== 'NOT_RUN');
  const complete = missing.length === 0 && duplicated.length === 0 && ran.length === expected.length && bindingOk;   // an unbound step list withholds the verdict
  const fails = ran.filter((r) => r.status === 'FAIL').length;
  const opFlags = ran.filter((r) => r.status === 'FLAG' && r.origin === 'operator').length;
  const overstated = ran.filter((r) => r.status === 'OVERSTATED').length;
  // RTP-CLAIM 1.2.0 ranking (rtpClaimVerdict): NOT PROVABLY FAIR (1) > INCOMPLETE (3) > RTP FIGURE OVERSTATED (5) > Conditional (2) > Full (0)
  const rv = rtpClaimVerdict({ fails: fails + extra, complete, overstated: overstated > 0, opFlags });
  const verdict = rv.verdict === 'INCOMPLETE' ? 'INCOMPLETE — steps not run' : rv.verdict;
  const exit = rv.exit;
  return { verdict, exit, missing, duplicated, fails, opFlags, overstated };
}
function notRunRow(id: string): Row { const p = prof(id); return { id, name: p.name, policy: p.policy, status: 'NOT_RUN', detail: 'no status from this run: the step did not run (deleted, skipped or aborted) — verdict withheld' }; }

/** The verification record: every scored check except LIMBO-27 (which compares the record) plus the informational ones,
 *  in profile order. finish() writes it and LIMBO-27 compares it with the committed outputs/verification-results.json. */
function recordOf() {
  const order = (id: string) => Number(id.split('-')[1]);
  // every package check (GRADED / RELEASE_GATE) is recorded too, except LIMBO-28, LIMBO-29: they attest this record itself
  // (LIMBO-28 and LIMBO-29 read gate records bound to sources that pin it), so verify prints them and does not record them
  const pkgRows = rows.filter((r) => (r.policy === 'GRADED' || r.policy === 'RELEASE_GATE') && !['LIMBO-28', 'LIMBO-29'].includes(r.id));
  const expected = EXPECTED_STEPS.filter((id) => id !== 'LIMBO-27');
  const have = new Set(rows.map((r) => r.id));
  const sorted = [...rows, ...expected.filter((id) => !have.has(id)).map(notRunRow)].sort((a, b) => order(a.id) - order(b.id));
  const scored = sorted.filter((r) => r.policy === 'HARD_FAIL' || r.policy === 'FLAG');
  const recRows = scored.filter((r) => r.id !== 'LIMBO-27');
  const v = verdictOf(recRows, expected);
  return { suite: 'housebets-limbo', profileSha256: PROFILE_SHA256, profileBinding: bindingOk, verdict: v.verdict,
    summary: { passes: recRows.filter((r) => r.status === 'PASS').length, fails: v.fails, overstated: v.overstated, operatorFlags: v.opFlags, captureFlags: recRows.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length, packageChecks: pkgRows.length, excluded: ['LIMBO-27'] },
    steps: [...recRows.concat(sorted.filter((r) => r.policy === 'INFORMATIONAL')), ...pkgRows].sort((a, b) => order(a.id) - order(b.id)).map((r) => ({ id: r.id, status: r.status, origin: r.origin ?? null, detail: r.detail })) };
}

function finish() {
  applyTaint();
  const order = (id: string) => Number(id.split('-')[1]);
  const have = new Set(rows.map((r) => r.id));
  for (const id of EXPECTED_STEPS) if (!have.has(id)) rows.push(notRunRow(id));
  rows.sort((a, b) => order(a.id) - order(b.id));
  const scored = rows.filter((r) => r.policy === 'HARD_FAIL' || r.policy === 'FLAG');
  const v = verdictOf(scored, EXPECTED_STEPS, extraFails());
  // belt and braces: a clean verdict needs exactly the expected number of scored steps to have run
  const ranCount = scored.filter((r) => r.status !== 'NOT_RUN').length;
  if (v.exit === 0 && ranCount !== EXPECTED_STEPS.length) throw new Error(`${ranCount} scored steps ran, ${EXPECTED_STEPS.length} expected — no verdict`);
  const capFlags = scored.filter((r) => r.status === 'FLAG' && r.origin === 'capture').length;
  const passes = scored.filter((r) => r.status === 'PASS').length;
  const pkg = rows.filter((r) => r.policy === 'GRADED' || r.policy === 'RELEASE_GATE');
  console.log(`HouseBets House Games limbo (new engine) — verification (profile LIMBO ${PROFILE_VERSION} ${PROFILE_SHA256.slice(0, 12)}…, ${rows.length} checks)`);
  for (const r of rows) console.log(`  ${r.id.padEnd(9)} ${(r.status + (r.origin === 'capture' ? '*' : '')).padEnd(6)} ${r.policy.padEnd(13)} ${r.name.padEnd(52)} ${r.detail}`);
  console.log(`  (* capture-origin FLAG: disclosed, verdict-neutral)`);
  console.log(`scored checks (HARD_FAIL + FLAG): ${passes} PASS, ${v.fails} FAIL, ${v.overstated} OVERSTATED, ${v.opFlags} operator FLAG, ${capFlags} capture FLAG, ${scored.filter((r) => r.status === 'NOT_RUN').length} NOT RUN of ${EXPECTED_STEPS.length} expected (EXPECTED_STEPS: the profile's scored checks; ran ${scored.filter((r) => r.status !== 'NOT_RUN').length}); informational ${rows.filter((r) => r.status === 'INFO').length}; package checks ${pkg.filter((r) => r.status === 'PASS').length}/${pkg.length} PASS (${pkg.filter((r) => r.status === 'GAP').map((r) => r.id).join(', ') || 'no gaps'})`);
  if (v.missing.length || v.duplicated.length) console.log(`scored checks with no status from this run: ${v.missing.join(', ') || 'none'}; recorded more than once: ${v.duplicated.join(', ') || 'none'}`);
  console.log(`profile binding: ${binding.detail}; MANIFEST.md cites ${PROFILE_PIN.slice(0, 12)}…: ${manifestCitesProfile} → ${bindingOk ? 'bound' : 'NOT BOUND — verdict withheld (INCOMPLETE)'}`);
  const failOutside = rows.filter((r) => r.status === 'FAIL' && r.policy !== 'HARD_FAIL' && r.policy !== 'FLAG').map((r) => r.id);
  if (failOutside.length) console.log(`FAIL outside the scored checks (verdict-bearing): ${failOutside.join(', ')}`);
  if (RUN_ERRORS.length) console.log(`run errors (${RUN_ERRORS.length}; any one fails the verdict): ${RUN_ERRORS.join(' | ')}`);
  console.log(`VERDICT: ${v.verdict}`);
  // the run record (outputs/run/ only) and its comparison with the committed record — verdict-bearing rows only
  const record = recordOf();
  mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
  writeFileSync(join(ROOT, 'outputs', 'run', 'verification-results.json'), JSON.stringify(record, null, 2) + '\n');
  const cf = join(ROOT, 'outputs', 'verification-results.json');
  if (existsSync(cf)) {
    const diffs = beyondTolerance(fieldDiff(JSON.parse(readFileSync(cf, 'utf8')), record));
    console.log(`Reproduction vs the committed outputs/verification-results.json on Node ${process.versions.node}: ${diffs.length === 0 ? 'REPRODUCED' : `DIFFERS (${diffs.length} fields, e.g. ${diffs.slice(0, 2).map((d: any) => d.path).join(', ')})`}`);
  }
  console.log(`runtime ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exitCode = v.exit;
}
