// REFERENCE COPY, not a runnable tool: the shared capture engine of the ProvablyFair.org audit of HouseBets,
// with comments edited (names, quotes, internal paths) and the code unchanged. Reference copy; the as-run copy
// was not kept (the datasets record its sha256 as 74a3e47c27fd3b92… for Phase A, fbc43aa169efe4dd…
// for Phases C and D and d791cce18884f688… for the $10 set; this file is a later version).
// ============================================================================
//  HouseBets House Games (new engine, Oct 2026) — shared capture core for the SINGLE-REQUEST games
//  (dice, limbo, coinflip, roulette, keno, plinko)  ·  ProvablyFair.org
//  Written 2026-10-10.
//
//  Design = the v3 dice rig of the earlier HouseBets audit, generalised:
//   · auth from a Copy-as-cURL file of POST /_api/housegames/refresh (reference loadAuth, unchanged)
//   · every client seed = <prefix> + crypto.randomBytes(16) hex (reference csprngClientSeed), logged
//   · pre-capture anchor (reference buildPreCapture): next-hash read BEFORE the first rotation must equal
//     epoch 0's hash; client-seed-after-commitment witness per epoch (reference commitmentWitness)
//   · fixed-size epochs, rotate via POST /change_seed BEFORE the bet that would overflow, revealed seed
//     journaled the instant it arrives; server nonce re-read before each rotation
//   · journal + --resume (bets and rotations replayed past the last checkpoint)
//   · every file write goes through writeJsonSafe / appendJsonlSafe (credential check), every stored
//     response through scrub()
//   · the bet plan (every setting, in CSPRNG order) is generated once and stored in the checkpoint, so a
//     resume continues the SAME plan; no Math.random anywhere
//  Differences from v3, and why:
//   · the HTTP client takes --origin so the offline mock can be used; any origin other than
//     https://www.housebets.com must be http://127.0.0.1 or http://localhost (no other host is reachable)
//   · outcome recompute is NOT duplicated in JS: at the end the rig runs verify-<game>.py (python3 -I)
//     on the file it just wrote and prints that result; the Python file is the single derivation
//   · a 400/422 answer to a bet (a setting the server refuses) is recorded in meta.rejected and the plan
//     moves on (v3 retried every error 8×; a deterministic refusal never succeeds on retry)
//
//  SUPPLEMENTARY PHASES (added 12 Oct 2026). With NO --phase flag the rig is
//  the Phase A rig, unchanged: same plan, file names, checkpoint/journal and resume. --phase=B|C|D runs ONE
//  supplementary phase as its own dataset: meta.phase, housebets-<game>-phase<P>-<n>bets.json, and its own
//  <game>-phase<P>-checkpoint.json / -journal.jsonl, so it never collides with a Phase A run in the same --out.
//   C  elevated stake: --stake-multiplier (default 100) × the minimum stake, exact in 1e-8 wallet units
//      (round(minimum × 1e8) × multiplier / 1e8); one fixed high-win-chance setting (adapter.phases.C)
//   B  (plinko2 only) one deep-sampled board at the minimum stake (adapter.phases.B)
//   D  player-set client seeds: --client-seeds=s1,s2,… (≥ 2, distinct), one per epoch IN ORDER, the anchor
//      rotation included; logged in meta.clientSeedLog with a source starting "player-set" (what
//      hbepochs.player_set reads); epochs × epoch-size bets at the minimum stake, settings drawn from the Phase A
//      plan (CSPRNG). --empty-seed-control: before epoch 0, POST /change_seed {clientSeed: ""} once and record the
//      server's answer (accepted or refused, status + body) in meta.emptySeedControl, then go on as planned.
//   Counts are whole epochs; the loop stops at the phase size (D carries one epoch of spare plan entries so a
//   refused setting cannot leave a short epoch). --plan-only --phase=P prints the phase's size and stake units.
// ============================================================================
import { randomInt, createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  loadAuth, csprngClientSeed, clientSeedSourceOf, CLIENT_SEED_SOURCE, CLIENT_SEED_FORMAT,
  scrub, writeJsonSafe, appendJsonlSafe, jwtBody, ttl, commitOf, nextCommitOf, buildPreCapture,
  commitmentWitness, checkWitness, drawnAtOf, ORIGIN,
} from '../reference/hb-capture-lib.mjs';

export const sha256Hex = (s) => createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CSPRNG helpers for plans (never Math.random) ────────────────────────────
export const rint = (lo, hiExcl) => randomInt(lo, hiExcl);
export function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = randomInt(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
export function sample(arr, k) { return shuffle(arr.slice()).slice(0, k); }

// ── args ─────────────────────────────────────────────────────────────────────
export function parseArgs(argv = process.argv.slice(2)) {
  const flag = (n, d) => { const h = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`)); if (!h) return d; const i = h.indexOf('='); return i === -1 ? true : h.slice(i + 1); };
  return { flag, PROBE: !!flag('probe', false), RESUME: !!flag('resume', false) };
}

// ── supplementary phases: flag parsing (none of this runs a different path when no phase flag is given) ──
export const PLAYER_SET_SOURCE = 'player-set (--client-seeds: typed in advance by the auditor; predictable, disclosed)';
const PHASE_ONLY_FLAGS = { 'stake-multiplier': 'C', stake: 'C', variant: 'C', 'client-seeds': 'D', 'empty-seed-control': 'D' };

function phaseOf(v, adapter) {
  if (v == null || v === false) return null;
  const p = String(v).toUpperCase();
  if (!['B', 'C', 'D'].includes(p)) throw new Error(`--phase=${v}: only B, C or D (Phase A is the run with no --phase)`);
  if (!adapter.phases || !adapter.phases[p]) throw new Error(`--phase=${p}: ${adapter.game} has no Phase ${p}`);
  return p;
}

function playerSeedsOf(v) {
  if (v == null) return null;
  if (v === true) throw new Error('--client-seeds needs a value: --client-seeds=s1,s2,s3,s4');
  const s = String(v).split(',');
  if (s.length < 2) throw new Error('--client-seeds: at least 2 seeds (Phase D floor: >= 2 distinct client seeds)');
  for (const x of s) if (!x || x.length > 64) throw new Error(`--client-seeds: "${x}" is empty or longer than 64 characters`);
  if (new Set(s).size !== s.length) throw new Error('--client-seeds: the seeds must be distinct');
  return s;
}

function checkOrigin(origin) {
  if (origin === ORIGIN) return origin;
  const u = new URL(origin);
  if (u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')) return u.origin;
  throw new Error(`--origin ${origin} refused: only ${ORIGIN} or a local mock (http://127.0.0.1:<port>) is allowed`);
}

// ── HTTP client (reference makeClient + configurable origin + generic paths) ──
//  Endpoints, all from the 10 Oct bundles:
//   POST <origin>/_api/housegames/refresh {apiUrl, intent, token, selectorToken} → {token}
//   requests carry header X-Token: <token>; base = <origin>/housegames
export function makeClient(auth, { origin, gameType, refererGame }) {
  let token = null, userId = null, lastStatus = null;   // lastStatus: HTTP status of the last /housegames answer (Phase D empty-seed control)
  const base = () => ({ accept: 'application/json', 'user-agent': auth.ua, origin, referer: `${origin}/games/housegames-${refererGame}`, cookie: auth.cookie });
  async function refresh() {
    const r = await fetch(`${origin}/_api/housegames/refresh`, { method: 'POST', headers: { ...base(), 'content-type': 'application/json' },
      body: JSON.stringify({ apiUrl: `${origin}/housegames`, intent: 'refresh', token: auth.refreshJwt, selectorToken: auth.refreshJwt }) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { throw new Error(`refresh non-JSON ${r.status}`); }
    if (r.status !== 200 || !j.token) throw new Error(`refresh ${r.status} — re-grab refresh.curl (cookie may be stale)`);
    token = j.token; userId = jwtBody(token).id ?? jwtBody(token).sub ?? null;
    return true;
  }
  const ensure = async () => { if (!token || ttl(token) < 60) await refresh(); };
  async function raw(method, path, body) {
    await ensure();
    const r = await fetch(`${origin}/housegames${path}`, { method, headers: { ...base(), 'content-type': 'application/json', 'x-token': token }, body: body ? JSON.stringify(body) : undefined });
    lastStatus = r.status;
    const t = await r.text(); let j;
    try { j = t ? JSON.parse(t) : null; } catch { const e = new Error(`${method} ${path} ${r.status} non-JSON: ${scrub(t.slice(0, 140))}`); e.status = r.status; throw e; }
    if (r.status === 401) { token = null; const e = new Error(`${method} ${path} 401`); e.status = 401; e.json = scrub(j); throw e; }
    if (r.status < 200 || r.status > 299) { const e = new Error(`${method} ${path} ${r.status}: ${JSON.stringify(scrub(j)).slice(0, 200)}`); e.status = r.status; e.json = scrub(j); e.retryAfter = r.headers.get('retry-after'); throw e; }
    return j;
  }
  return {
    refresh, get userId() { return userId; }, get tokenTtl() { return token ? ttl(token) : 0; }, get lastStatus() { return lastStatus; },
    raw,
    seedsRaw: () => raw('GET', `/seeds?gameType=${encodeURIComponent(gameType)}`),
    seeds: async () => (await raw('GET', `/seeds?gameType=${encodeURIComponent(gameType)}`)).seed,
    rotate: (clientSeed) => raw('POST', '/change_seed', { gameType, clientSeed }),
  };
}

/** 429 → wait (Retry-After or 2 s, doubling to 30 s) and retry the same request; never counted as an error. */
function with429(fn, log) {
  return async (...a) => {
    let wait = 2000;
    for (;;) {
      try { return await fn(...a); } catch (e) {
        if (e.status !== 429) throw e;
        const ra = Number(e.retryAfter); const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait;
        log(`  429 — backing off ${ms} ms`); await sleep(ms); wait = Math.min(wait * 2, 30000);
      }
    }
  };
}

// ── the capture engine ───────────────────────────────────────────────────────
/**
 * adapter = {
 *   game, gameType, betPath, limitsSlug, fairnessSlug, seedPrefix, extraGets: [path…],
 *   buildPlan(opts) → [{cls, …setting}]                       (CSPRNG only)
 *   probePlan(opts) → [{cls, …setting}]
 *   stakeOf(setting, base) → number                            (total staked on the round)
 *   body(setting, base, currency) → request body object         (exactly what is POSTed)
 *   extract(resp, setting) → { nonce, clientSeed, hashedSeed, outcome, payoutMultiplier, payout, balance, roundId, sameSetting, …game fields }
 *   planDoc → one-line description for meta
 * }
 */
export async function runCapture(adapter, here) {
  const { flag, PROBE, RESUME } = parseArgs();
  const G = adapter.game;
  const OUT = flag('out', join(here, 'outputs'));
  if (!flag('plan-only', false) && !existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  const origin = checkOrigin(flag('origin', ORIGIN));
  const CURL = flag('curl', join(here, 'refresh.curl'));
  const EPOCH = Number(flag('epoch', 50));
  const DELAY = Number(flag('delay', 0));
  const CURRENCY = Number(flag('currency', 1));   // 1 = the code the old-engine captures sent for USDT; re-confirm on the probe
  const PER_CLASS = flag('per-class', null);      // dry-run / smoke: keep the first N plan entries of every class
  // supplementary phase (null = Phase A, the default run: every name and path below is then exactly as before)
  const PHASE = phaseOf(flag('phase', null), adapter);
  for (const [f, p] of Object.entries(PHASE_ONLY_FLAGS)) if (flag(f, null) != null && PHASE !== p) throw new Error(`--${f} applies to --phase=${p} only`);
  if (PHASE && (PROBE || flag('repeat', null) != null)) throw new Error(`--probe and --repeat do not apply to --phase=${PHASE}`);
  const MULT = PHASE === 'C' ? Number(flag('stake-multiplier', 100)) : 1;
  if (!(Number.isInteger(MULT) && MULT >= 1)) throw new Error(`--stake-multiplier=${flag('stake-multiplier')}: a whole number >= 1`);
  // 13 Oct: --stake=<x> sets Phase C's stake per bet (roulette: per chip) as an absolute
  // amount, exact in 1e-8; --variant=<name> plays adapter.phases.C.variants[name] (a higher win-chance setting) instead of
  // phases.C. Both change the file names (…-phaseC-<variant>-<stake>usd-…) so they never touch the 100 × minimum Phase C run.
  const STAKE_ABS = PHASE === 'C' && flag('stake', null) != null ? Number(flag('stake')) : null;
  if (STAKE_ABS != null && !(STAKE_ABS > 0 && Math.round(STAKE_ABS * 1e8) === STAKE_ABS * 1e8)) throw new Error(`--stake=${flag('stake')}: a positive amount with at most 8 decimals`);
  if (STAKE_ABS != null && flag('stake-multiplier', null) != null) throw new Error('--stake and --stake-multiplier exclude each other');
  const VARIANT = PHASE === 'C' ? flag('variant', null) : null;
  if (VARIANT != null && !(adapter.phases.C.variants && adapter.phases.C.variants[VARIANT])) throw new Error(`--variant=${VARIANT}: ${G} has no Phase C variant of that name`);
  const PDEF = PHASE ? (VARIANT != null ? adapter.phases.C.variants[VARIANT] : adapter.phases[PHASE]) : null;
  const EMPTY_CONTROL = PHASE === 'D' && !!flag('empty-seed-control', false);
  const PLAYER_SEEDS = PHASE === 'D' ? playerSeedsOf(flag('client-seeds', null)) : null;   // validated before any request
  if (PHASE === 'D' && !PLAYER_SEEDS && !RESUME && !flag('plan-only', false)) throw new Error('--phase=D needs --client-seeds=s1,s2,… (one per epoch, in order)');
  const SEEDS_SET_AT = now();   // when --client-seeds was read: the player-set seeds exist from this moment (before any commitment read)
  const PSUF = (VARIANT != null ? `-${VARIANT}` : '') + (STAKE_ABS != null ? `-${STAKE_ABS}usd` : '');
  const TAG = PHASE ? `${G}-phase${PHASE}${PSUF}` : G;
  const CHECKPOINT = join(OUT, `${TAG}-checkpoint.json`);
  const JOURNAL = join(OUT, `${TAG}-journal.jsonl`);
  const SCRIPT_SHA256 = createHash('sha256').update(readFileSync(adapter.scriptFile)).digest('hex');
  const CORE_SHA256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
  const say = (m) => console.log(m);

  let dataset = {
    meta: {
      platform: 'housebets.com', game: G, gameType: adapter.gameType, schema: `housebets-${G}-capture-sp1`, createdAt: now(),
      origin, betPath: adapter.betPath, currency: CURRENCY,
      captureScript: { file: basename(adapter.scriptFile), sha256: SCRIPT_SHA256, core: 'common/hb-sp-core.mjs', coreSha256: CORE_SHA256 },
      clientSeedGenerator: { source: CLIENT_SEED_SOURCE, format: CLIENT_SEED_FORMAT, csprng: true, prefix: adapter.seedPrefix },
      settingGenerator: 'node:crypto randomInt (plan built once, CSPRNG-shuffled, stored in meta.plan)',
      planDoc: adapter.planDoc, epochSize: EPOCH, clientSeedLog: [], rejected: [], preflight: {},
    },
    preCapture: null, seeds: [], bets: [],
  };
  if (PHASE) Object.assign(dataset.meta, { planDoc: PDEF.doc, phaseVariant: VARIANT, phase: PHASE, phaseOfFramework: 'audit-rules §2.5 supplementary phase (separate dataset, own evidence ID)' });
  const seedLog = () => dataset.meta.clientSeedLog;
  const isPlayerSeed = (cs) => seedLog().some((e) => e.clientSeed === cs && String(e.source || '').startsWith('player-set'));
  /** The client seed for epoch k: Phase D plays the k-th player-set seed; every other epoch (and every Phase A/B/C
   *  epoch) draws a CSPRNG seed exactly as before. */
  function clientSeedForEpoch(k, prefix) {
    const ps = PHASE === 'D' ? dataset.meta.playerClientSeeds : null;
    if (!ps || k >= ps.length) return csprngClientSeed(prefix, seedLog());
    const s = ps[k];
    if (!seedLog().some((e) => e.clientSeed === s)) seedLog().push({ clientSeed: s, prefix: null, source: PLAYER_SET_SOURCE, generatedAt: dataset.meta.playerClientSeedsSetAt, usedAt: now(), epoch: k });
    return s;
  }
  const witnessMap = () => (dataset.meta.commitmentWitnesses ??= {});
  const save = () => { dataset.meta.savedAt = now(); writeJsonSafe(CHECKPOINT, dataset); };

  // ── epoch close (reference closePair / finishPair, minus the JS recompute) ──
  function finishPair(rot) {
    const { pair, oldServerSeed, serverNonceAtRotation, serverPairIdAtRotation, nextClientSeed } = rot;
    const next = { ...rot.next, _readAt: rot.at };
    witnessMap()[next.id] = rot.witnessForNext;
    if (rot.seedLogEntry && !seedLog().some((e) => e.clientSeed === rot.seedLogEntry.clientSeed)) seedLog().push(rot.seedLogEntry);
    const epoch = dataset.seeds.length;
    const mine = dataset.bets.filter((b) => b.epoch === epoch);
    const commitOk = sha256Hex(oldServerSeed) === pair.hashedServerSeed;
    const chainLinkOk = pair.hashedNextServerSeed ? pair.hashedNextServerSeed === commitOf(next) : null;
    const witness = checkWitness(witnessMap()[pair.id], pair.hashedServerSeed);
    dataset.seeds.push({
      seedId: pair.id, epoch, clientSeed: pair.clientSeed, clientSeedSource: clientSeedSourceOf(seedLog(), pair.clientSeed),
      hashedServerSeed: pair.hashedServerSeed, hashedNextServerSeed: pair.hashedNextServerSeed ?? null,
      revealedServerSeed: oldServerSeed, nonceStart: pair.nonce ?? null, nonceEnd: mine.length ? mine[mine.length - 1].nonce : null,
      serverNonceAtRotation, serverPairIdAtRotation, rotatedAt: rot.at, nextClientSeed,
      rotateResponseExtra: rot.extra ?? null,
      clientSeedDrawnAfterCommitment: witness, commitmentValid: commitOk, chainLinkOk, bets: mine.length,
    });
    const nonceNote = serverNonceAtRotation != null && mine.length && serverNonceAtRotation !== mine[mine.length - 1].nonce ? ` ⚠ server nonce ${serverNonceAtRotation} ≠ last captured ${mine[mine.length - 1].nonce}` : '';
    say(`  ↻ epoch ${epoch} pair ${pair.id} commit ${commitOk ? 'OK' : 'FAIL'} chain ${chainLinkOk == null ? 'n/a' : chainLinkOk ? 'OK' : 'FAIL'} bets ${mine.length}${nonceNote}`);
    // a player-set (Phase D) seed is chosen before the commitment by design: its timing is disclosed, not a failure
    if (!commitOk || chainLinkOk === false || witness.equalsEpochHash !== true || (witness.readBeforeDraw === false && !isPlayerSeed(pair.clientSeed)))
      say(`  ⚠️ INTEGRITY FAIL epoch ${epoch}: commit=${commitOk} chain=${chainLinkOk} seedDrawnAfterCommitment=${witness.equalsEpochHash}/${witness.readBeforeDraw}`);
    return next;
  }
  async function closePair(hb, pair) {
    let serverNonceAtRotation = null, serverPairIdAtRotation = null, publishedNext = pair.hashedNextServerSeed ?? null, readAt = null;
    try { const cur = await hb.seeds(); readAt = now(); serverNonceAtRotation = cur.nonce ?? null; serverPairIdAtRotation = cur.id ?? null; if (cur.id === pair.id && nextCommitOf(cur)) publishedNext = nextCommitOf(cur); } catch {}
    if (!readAt) readAt = pair._readAt ?? null;
    const nextSeed = clientSeedForEpoch(dataset.seeds.length + 1, adapter.seedPrefix);   // = csprngClientSeed(prefix, log) outside Phase D
    const resp = await hb.rotate(nextSeed);
    const { oldServerSeed, seed: next } = resp;
    const extra = scrub(Object.fromEntries(Object.entries(resp).filter(([k]) => k !== 'oldServerSeed' && k !== 'seed')));
    const rot = { type: 'rotation', at: now(), epoch: dataset.seeds.length,
      pair: { id: pair.id, clientSeed: pair.clientSeed, hashedServerSeed: pair.hashedServerSeed, hashedNextServerSeed: pair.hashedNextServerSeed ?? null, nonce: pair.nonce ?? null },
      nextClientSeed: nextSeed, seedLogEntry: seedLog().find((e) => e.clientSeed === nextSeed) || null, oldServerSeed, next: scrub(next), extra,
      serverNonceAtRotation, serverPairIdAtRotation,
      witnessForNext: commitmentWitness({ committedHash: publishedNext, source: `epoch ${dataset.seeds.length} hashedNextServerSeed (read before the draw)`, readAt, clientSeed: nextSeed, clientSeedDrawnAt: drawnAtOf(seedLog(), nextSeed) }) };
    if (!PROBE) appendJsonlSafe(JOURNAL, rot);   // first thing after the answer: the revealed seed is never lost
    return finishPair(rot);
  }

  async function anchorPreCapture(hb) {
    const recordedAt = now();
    const rawSeedsBefore = await hb.seedsRaw(); const beforeReadAt = now();
    const before = rawSeedsBefore.seed;
    if (nextCommitOf(before) == null) say('  ⚠️ GET /seeds exposed no hashedNextServerSeed before epoch 0 — anchor stays null (not filled in)');
    const clientSeedUsed = clientSeedForEpoch(0, adapter.seedPrefix + 'start');   // = csprngClientSeed(prefix+'start', log) outside Phase D
    const { oldServerSeed, seed: rotateResponseSeed } = await hb.rotate(clientSeedUsed);
    const after = await hb.seeds(); after._readAt = now();
    witnessMap()[after.id] = commitmentWitness({ committedHash: nextCommitOf(before), source: 'preCapture.hashedNextServerSeed (read before the draw)', readAt: beforeReadAt, clientSeed: clientSeedUsed, clientSeedDrawnAt: drawnAtOf(seedLog(), clientSeedUsed) });
    const pc = buildPreCapture({ before, rawSeedsBefore, recordedAt, oldServerSeed, commitVerified: oldServerSeed ? sha256Hex(oldServerSeed) === commitOf(before) : null,
      after, rotateResponseSeed, clientSeedUsed, clientSeedSource: isPlayerSeed(clientSeedUsed) ? PLAYER_SET_SOURCE : CLIENT_SEED_SOURCE });
    say(`  pre-capture: hash ${String(pc.hashedServerSeed).slice(0, 12)}… next ${pc.hashedNextServerSeed ? pc.hashedNextServerSeed.slice(0, 12) + '…' : 'null'} → epoch 0 ${String(pc.epoch0HashedServerSeed).slice(0, 12)}…  anchor ${pc.anchorOk === true ? 'OK' : pc.anchorOk === false ? 'MISMATCH' : 'n/a'}  reveal-commit ${pc.commitVerified ? 'OK' : 'FAIL'}`);
    return { pc, pair: after };
  }

  async function preflight(hb) {
    const pf = dataset.meta.preflight;
    const gets = [[`limits`, `/limits/${adapter.limitsSlug}`], [`fairness`, `/${adapter.fairnessSlug}/fairness`], ...(adapter.extraGets || []).map((p) => [p, p])];
    for (const [k, p] of gets) {
      try { pf[k] = { path: p, at: now(), body: scrub(await hb.raw('GET', p)) }; say(`  preflight GET ${p}: saved`); }
      catch (e) { pf[k] = { path: p, at: now(), error: String(e.message).slice(0, 200) }; say(`  preflight GET ${p}: ${String(e.message).slice(0, 120)} (recorded, not fatal)`); }
    }
    const lim = pf.limits && pf.limits.body;
    const fromLimits = lim ? (lim.wallet && Number(lim.wallet.minBet) > 0 ? Number(lim.wallet.minBet) : Number(lim.minBet) > 0 ? Number(lim.minBet) : null) : null;
    const arg = flag('base-stake', null);
    const base = arg != null ? Number(arg) : fromLimits;
    if (!(base > 0)) throw new Error('no minimum stake: GET /limits gave none — pass --base-stake=<amount in the wallet currency>');
    dataset.meta.baseStake = base;
    dataset.meta.baseStakeSource = arg != null ? '--base-stake' : lim.wallet && Number(lim.wallet.minBet) > 0 ? 'limits.wallet.minBet' : 'limits.minBet';
    say(`  base stake ${base} (${dataset.meta.baseStakeSource})`);
    return base;
  }

  async function placeBet(hb, entry, base, keepRawAlways) {
    const body = adapter.body(entry, base, CURRENCY, { userId: hb.userId });
    const at = now();
    const resp = await hb.bet(body);
    const x = adapter.extract(resp, entry);
    return { at, cls: entry.cls, setting: entry, request: body, stake: adapter.stakeOf(entry, base), ...x, _raw: scrub(resp), _kept: keepRawAlways };
  }

  function load() {
    if (!existsSync(CHECKPOINT)) throw new Error('--resume: no checkpoint');
    const saved = JSON.parse(readFileSync(CHECKPOINT, 'utf8'));
    // phase guards BEFORE the checkpoint is adopted, so a refused resume writes nothing (no-op for Phase A: both null)
    if ((saved.meta.phase ?? null) !== PHASE) throw new Error(`--resume: the checkpoint is ${saved.meta.phase ? 'Phase ' + saved.meta.phase : 'Phase A'}, this run was started as ${PHASE ? 'Phase ' + PHASE : 'Phase A'}`);
    if (PHASE === 'D' && PLAYER_SEEDS && JSON.stringify(PLAYER_SEEDS) !== JSON.stringify(saved.meta.playerClientSeeds))
      throw new Error('--resume: --client-seeds differs from the seeds this Phase D run started with (meta.playerClientSeeds); omit it to continue with those');
    dataset = saved;
    let replayed = 0, recovered = 0;
    if (existsSync(JOURNAL)) for (const line of readFileSync(JOURNAL, 'utf8').split('\n')) {
      if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.type === 'bet' && j.rec.idx === dataset.bets.length) { dataset.bets.push(j.rec); replayed++; }
      else if (j.type === 'reject' && !dataset.meta.rejected.some((r) => r.planIdx === j.rec.planIdx)) dataset.meta.rejected.push(j.rec);
      else if (j.type === 'rotation' && j.epoch === dataset.seeds.length) { finishPair(j); recovered++; }
    }
    say(`resumed: ${dataset.bets.length} bets (${replayed} from journal), ${dataset.seeds.length} epochs (${recovered} finished from journaled rotations)`);
  }

  function runVerifier(file) {
    const v = join(here, `verify-${G}.py`);
    const r = spawnSync('python3', ['-I', v, file], { encoding: 'utf8' });
    console.log((r.stdout || '') + (r.stderr || ''));
    return r.status === 0;
  }

  /** A supplementary phase's plan. B/C: adapter.phases[P].count entries of the one fixed setting (entry() is called per
   *  bet, so a per-bet CSPRNG draw such as a coin call stays per bet). D: one epoch per player seed, settings drawn
   *  from fresh Phase A plans (CSPRNG-shuffled), plus one epoch of spare entries used only if the server refuses one. */
  function phasePlan(seeds) {
    const P = PDEF;
    if (PHASE === 'D') {
      const epochs = seeds ? seeds.length : 4, target = epochs * EPOCH, spare = EPOCH;
      const pool = [];
      while (pool.length < target + spare) {
        const more = adapter.buildPlan({ flag, phase: 'D' }).filter((e) => !P.keep || P.keep(e));
        if (!more.length) throw new Error('Phase D: the Phase A plan gave no usable entry');
        pool.push(...more);
      }
      return { target, spare, epochs, plan: shuffle(pool).slice(0, target + spare) };
    }
    if (!(P.count > 0) || P.count % EPOCH) throw new Error(`Phase ${PHASE}: ${P.count} bets is not a whole number of epochs of ${EPOCH}`);
    return { target: P.count, spare: 0, epochs: P.count / EPOCH, plan: Array.from({ length: P.count }, () => P.entry()) };
  }

  /** Phase D control: ask the server to rotate to an EMPTY client seed once, before epoch 0, and record what it answers.
   *  Refused → nothing changed on the server. Accepted → the server rotated: the revealed seed is checked against the
   *  hash read just before, and the anchor that follows starts from the pair the control left active. */
  async function emptySeedControl(hb) {
    const rec = { at: now(), request: { method: 'POST', path: '/change_seed', body: { gameType: adapter.gameType, clientSeed: '' } } };
    let before = null;
    try { before = await hb.seeds(); rec.seedsBeforeReadAt = now(); rec.seedsBefore = scrub(before); } catch (e) { rec.seedsBeforeError = String(e.message).slice(0, 200); }
    for (let attempt = 0; ; attempt++) {
      try {
        const j = await hb.raw('POST', '/change_seed', { gameType: adapter.gameType, clientSeed: '' });
        Object.assign(rec, { answeredAt: now(), status: client.lastStatus, outcome: 'accepted', body: scrub(j) });
        break;
      } catch (e) {
        if (e.status === 401 && attempt === 0) continue;   // token expired: the client refreshes on the next call
        if (e.status == null) throw e;                      // no answer at all (network): not a server answer, stop
        Object.assign(rec, { answeredAt: now(), status: e.status, outcome: e.status >= 500 ? 'server-error' : 'refused', body: e.json ?? null, message: String(e.message).slice(0, 300) });
        break;
      }
    }
    if (rec.outcome === 'accepted') {
      const old = rec.body && rec.body.oldServerSeed;
      rec.revealCommitOk = old && before ? sha256Hex(old) === commitOf(before) : null;
      try { const after = await hb.seeds(); rec.seedsAfterReadAt = now(); rec.seedsAfter = scrub(after); rec.clientSeedAfter = after.clientSeed ?? null; rec.chainOk = before && nextCommitOf(before) ? nextCommitOf(before) === commitOf(after) : null; }
      catch (e) { rec.seedsAfterError = String(e.message).slice(0, 200); }
    }
    writeJsonSafe(join(OUT, `${TAG}-empty-seed-control-${Date.now()}.json`), rec);   // kept even if the run stops before its first checkpoint
    say(`  empty-seed control: POST /change_seed clientSeed "" → ${rec.outcome} (HTTP ${rec.status}) ${JSON.stringify(rec.body).slice(0, 200)}${rec.outcome === 'accepted' ? ` · reveal-commit ${rec.revealCommitOk} · chain ${rec.chainOk} · client seed now ${JSON.stringify(rec.clientSeedAfter)}` : ''}`);
    return rec;
  }

  // ── main ──
  if (flag('plan-only', false) && PHASE) {   // offline: the phase's size and stake in units of the minimum stake; no auth, no request
    const seeds = PLAYER_SEEDS;
    const ph = phasePlan(seeds), played = ph.plan.slice(0, ph.target);
    const counts = played.reduce((m, e) => ((m[e.cls] = (m[e.cls] || 0) + 1), m), {});
    console.log(JSON.stringify({ game: G, phase: PHASE, rounds: ph.target, epochs: ph.epochs, epochSize: EPOCH, stakePerBetUnits: adapter.stakeOf(played[0], MULT),
      stakeMultiplier: MULT, stakeUnits: played.reduce((s, e) => s + adapter.stakeOf(e, MULT), 0), spareEntries: ph.spare, classes: Object.keys(counts).length, counts,
      setting: PDEF.doc, stakeAbsolute: STAKE_ABS, ...(PHASE === 'D' ? { clientSeeds: seeds || 'not given: 4 epochs assumed', emptySeedControl: EMPTY_CONTROL } : {}) }));
    return;
  }
  if (flag('plan-only', false)) {   // offline: print the plan's size, classes and stake in units of the base stake; no auth, no request
    const REPEAT = Math.max(1, Number(flag('repeat', 1)) || 1);
    const plan = []; for (let k = 0; k < REPEAT; k++) plan.push(...adapter.buildPlan({ flag }));
    const units = plan.reduce((s, e) => s + adapter.stakeOf(e, 1), 0);
    const counts = plan.reduce((m, e) => ((m[e.cls] = (m[e.cls] || 0) + 1), m), {});
    console.log(JSON.stringify({ game: G, rounds: plan.length, classes: Object.keys(counts).length, stakeUnits: units, epochs: Math.ceil(plan.length / EPOCH), counts }));
    return;
  }
  if (PHASE && !RESUME) {   // before any request: a phase rotates the account's ONE seed pair for this gameType, never while this game's Phase A is open here
    const a = join(OUT, `${G}-checkpoint.json`);
    let open = false;
    if (existsSync(a)) { try { open = !(JSON.parse(readFileSync(a, 'utf8')).meta || {}).finishedAt; } catch { open = true; } }
    if (open) throw new Error(`Phase A of ${G} is unfinished in this --out (${a} has no finishedAt): a phase rotates the same server seed pair (gameType ${adapter.gameType}) and would break that run. Finish Phase A first.`);
  }
  const auth = loadAuth(CURL);
  const client = makeClient(auth, { origin, gameType: adapter.gameType, refererGame: adapter.game });
  const hb = { ...client, get userId() { return client.userId; } };
  for (const k of ['raw', 'seedsRaw', 'seeds', 'rotate']) hb[k] = with429(client[k], say);
  hb.bet = with429((body) => client.raw('POST', adapter.betPath, body), say);
  await client.refresh();
  say(`HouseBets ${G} capture — ${PROBE ? 'PROBE' : RESUME ? 'RESUME' : 'FULL RUN'}${PHASE ? ` · PHASE ${PHASE}` : ''} · origin ${origin} · token ttl ${client.tokenTtl}s · script ${SCRIPT_SHA256.slice(0, 16)}…`);

  if (PROBE) {
    const base = await preflight(hb);
    const { pc, pair } = await anchorPreCapture(hb);
    dataset.preCapture = pc;
    const plan = adapter.probePlan();
    dataset.meta.plan = plan;
    for (const entry of plan) {
      try {
        const rec = await placeBet(hb, entry, base, true);
        rec.idx = dataset.bets.length; rec.epoch = 0; rec.planIdx = plan.indexOf(entry);
        if (rec.nonce == null) { rec.nonce = (pair.nonce ?? 0) + dataset.bets.length + 1; rec.nonceSource = 'derived'; } else rec.nonceSource = 'response';
        dataset.bets.push(rec);
        say(`  probe bet ${rec.idx} ${entry.cls}: nonce ${rec.nonce} outcome ${JSON.stringify(rec.outcome)} ×${rec.payoutMultiplier} payout ${rec.payout}`);
      } catch (e) {
        if (e.status === 400 || e.status === 422) { dataset.meta.rejected.push({ planIdx: plan.indexOf(entry), cls: entry.cls, setting: entry, status: e.status, body: e.json ?? null, at: now() }); say(`  probe ${entry.cls} REJECTED ${e.status}: ${String(e.message).slice(0, 160)}`); }
        else throw e;
      }
      if (DELAY) await sleep(DELAY);
    }
    await closePair(hb, pair);
    dataset.meta.postCapture = { at: now(), activePair: scrub(await hb.seeds().catch(() => null)) };
    const file = join(OUT, `${G}-probe-${Date.now()}.json`);
    writeJsonSafe(file, { ...dataset, meta: { ...dataset.meta, kind: 'probe', finishedAt: now() } });
    console.log(`\n── PROBE RESULT ── file ${file}`);
    const s = dataset.seeds[0];
    console.log(`  anchor ${pc.anchorOk} · commit ${s.commitmentValid} · chain ${s.chainLinkOk} · witness ${s.clientSeedDrawnAfterCommitment.equalsEpochHash}/${s.clientSeedDrawnAfterCommitment.readBeforeDraw} · server nonce ${s.serverNonceAtRotation} vs last ${s.nonceEnd} · rejected ${dataset.meta.rejected.length}`);
    const vok = runVerifier(file);
    const green = pc.anchorOk === true && s.commitmentValid && s.chainLinkOk !== false && s.clientSeedDrawnAfterCommitment.equalsEpochHash === true && vok && dataset.meta.rejected.length === 0;
    console.log(green ? '  PROBE GREEN — ready for the full run.' : '  PROBE NOT GREEN — send the probe file; do not start the full run.');
    return;
  }

  try { await fullRun(); } catch (e) { try { if (dataset.preCapture) { save(); console.log(`  checkpoint saved (${dataset.bets.length} bets) — fix the cause, then --resume`); } } catch {} throw e; }

  async function fullRun() {
  if (RESUME) load();
  else if (existsSync(CHECKPOINT) || existsSync(JOURNAL)) throw new Error(`${CHECKPOINT} or its journal exists — use --resume, or move both aside`);

  let base, pair;
  if (!dataset.preCapture) {
    let plan = [];
    if (PHASE) {   // supplementary phase: its own plan, size and stake (Phase A below is untouched)
      const seeds = PLAYER_SEEDS;
      base = await preflight(hb);
      const ph = phasePlan(seeds);
      plan = ph.plan;
      Object.assign(dataset.meta, { phaseTarget: ph.target, phaseEpochs: ph.epochs, phaseSpareEntries: ph.spare, phaseSetting: PDEF.setting ?? null });
      if (PHASE === 'D') Object.assign(dataset.meta, { playerClientSeeds: seeds, playerClientSeedSource: PLAYER_SET_SOURCE, playerClientSeedsSetAt: SEEDS_SET_AT });
      dataset.meta.phaseStake = STAKE_ABS != null
        ? { minimum: base, minimumSource: dataset.meta.baseStakeSource, multiplier: null, kind: 'absolute', stake: STAKE_ABS,
            rule: 'stake = --stake as given, exact in the wallet unit 1e-8; one stake per bet (roulette: per chip)' }
        : { minimum: base, minimumSource: dataset.meta.baseStakeSource, multiplier: MULT, stake: Math.round(base * 1e8) * MULT / 1e8,
        rule: 'stake = round(minimum × 1e8) × multiplier / 1e8: exact in the wallet unit 1e-8; one stake per bet (roulette: per chip)' };
      if (STAKE_ABS != null && Math.round(STAKE_ABS * 1e8) < 100 * Math.round(base * 1e8)) throw new Error(`--stake=${STAKE_ABS} is below 100 × the minimum ${base}`);
      say(`  Phase ${PHASE}${PSUF}: ${ph.target} bets = ${ph.epochs} epochs × ${EPOCH} · stake ${dataset.meta.phaseStake.stake} (${STAKE_ABS != null ? 'absolute, --stake' : `${MULT} × minimum ${base}`})${PHASE === 'D' ? ` · player-set client seeds ${JSON.stringify(seeds)}` : ''}`);
    } else {
    base = await preflight(hb);
    // --repeat=N (full captures, 12 Oct): N independent draws of the plan (fresh CSPRNG settings each), shuffled together
    const REPEAT = Math.max(1, Number(flag('repeat', 1)) || 1);
    for (let k = 0; k < REPEAT; k++) plan.push(...adapter.buildPlan({ flag }));
    if (REPEAT > 1) { shuffle(plan); dataset.meta.planRepeat = REPEAT; }
    }
    if (PER_CLASS) { const n = Number(PER_CLASS), seen = {}; plan = plan.filter((e) => (seen[e.cls] = (seen[e.cls] || 0) + 1) <= n); dataset.meta.planTruncated = `--per-class=${n}`; }
    dataset.meta.plan = plan;
    dataset.meta.planCounts = plan.reduce((m, e) => ((m[e.cls] = (m[e.cls] || 0) + 1), m), {});
    if (EMPTY_CONTROL) dataset.meta.emptySeedControl = await emptySeedControl(hb);
    const r = await anchorPreCapture(hb); dataset.preCapture = r.pc; pair = r.pair; dataset.meta.openEpochStartNonce = pair.nonce ?? 0; save();
  } else {
    base = dataset.meta.baseStake;
    pair = await hb.seeds(); pair._readAt = now();
    pair.serverNonceAtResume = pair.nonce ?? null;
    pair.nonce = dataset.meta.openEpochStartNonce ?? 0;   // the epoch's START nonce (what nonceStart and derived nonces count from)
    const closed = new Set(dataset.seeds.map((s) => s.seedId));
    const orphans = [...new Set(dataset.bets.map((b) => b.pairId))].filter((id) => !closed.has(id) && id !== pair.id);
    if (orphans.length) { (dataset.meta.orphanedPairs ??= []).push({ at: now(), seedIds: orphans }); say(`  ⚠️ orphaned pair(s) ${orphans.join(', ')} — recorded in meta.orphanedPairs`); }
    const onPair = dataset.bets.filter((b) => b.epoch === dataset.seeds.length).map((b) => b.nonce);
    const lost = []; for (let n = (pair.nonce ?? 0) + 1; n <= (pair.serverNonceAtResume ?? 0); n++) if (!onPair.includes(n)) lost.push(n);
    if (lost.length) { (dataset.meta.lostNonces ??= []).push({ at: now(), seedId: pair.id, nonces: lost, reason: 'accepted by the server while the capture died, before its journal line; outcome recomputable, served answer not recorded' }); say(`  ⚠️ nonce(s) ${lost.join(', ')} consumed but not recorded — meta.lostNonces`); save(); }
  }
  const plan = dataset.meta.plan;
  // Phase A: STAKE = base, TARGET = null, TOTAL = plan.length (as before). A phase stops at its size (D's spares unused).
  const STAKE = PHASE ? dataset.meta.phaseStake.stake : base;
  const TARGET = PHASE ? dataset.meta.phaseTarget : null;
  const TOTAL = PHASE ? Math.min(TARGET, plan.length) : plan.length;
  say(`plan: ${TOTAL} rounds · epochs of ${EPOCH} · base stake ${base}${PHASE ? ` · Phase ${PHASE} bet stake ${STAKE} (${STAKE_ABS != null ? 'absolute, --stake' : `${MULT} × minimum`})` : ''} · total staked ${Math.round(plan.slice(0, TOTAL).reduce((s, e) => s + adapter.stakeOf(e, STAKE), 0) * 1e8) / 1e8}`);
  say(`classes: ${JSON.stringify(dataset.meta.planCounts)}`);
  process.on('SIGINT', () => { console.log('\ninterrupted — saving…'); save(); console.log(`saved ${dataset.bets.length} bets. Re-run with --resume.`); process.exit(0); });

  let placedOnPair = dataset.bets.filter((b) => b.epoch === dataset.seeds.length).length;
  const doneIdx = new Set([...dataset.bets.map((b) => b.planIdx), ...dataset.meta.rejected.map((r) => r.planIdx)]);
  let errors = 0;
  for (let i = 0; i < plan.length; i++) {
    if (TARGET != null && dataset.bets.length >= TARGET) break;   // phases only: the phase's size reached
    if (doneIdx.has(i)) continue;
    if (EPOCH && placedOnPair >= EPOCH) { pair = await closePair(hb, pair); placedOnPair = 0; dataset.meta.openEpochStartNonce = pair.nonce ?? 0; save(); }
    const entry = plan[i];
    try {
      const rec = await placeBet(hb, entry, STAKE, false);
      rec.idx = dataset.bets.length; rec.planIdx = i; rec.epoch = dataset.seeds.length; rec.pairId = pair.id;
      if (rec.nonce == null) { rec.nonce = (pair.nonce ?? 0) + placedOnPair + 1; rec.nonceSource = 'derived'; } else rec.nonceSource = 'response';
      delete rec._kept;   // the scrubbed raw answer is kept for EVERY round: the response shape is new and only partly known from the bundle
      dataset.bets.push(rec); appendJsonlSafe(JOURNAL, { type: 'bet', rec });
      placedOnPair++; errors = 0;
      say(`  [${rec.idx + 1}/${TOTAL}] e${rec.epoch} n=${rec.nonce} ${entry.cls} → ${JSON.stringify(rec.outcome)} ×${rec.payoutMultiplier} pay ${rec.payout}`);
      if (dataset.bets.length % 50 === 0) save();
      if (DELAY) await sleep(DELAY);
    } catch (err) {
      // 12 Oct: the server also answers 400 {"error":"Transaction temporarily unavailable"} to a bet it did not place (no
      // nonce used). That is not a refusal of the setting: retry it like any other error, with a fresh generation.
      const transient = err.status === 400 && /temporarily unavailable/i.test(JSON.stringify(err.json ?? err.message ?? ''));
      if (transient) (dataset.meta.transientRetries ??= []).push({ planIdx: i, cls: entry.cls, status: err.status, body: err.json ?? null, at: now() });
      if (!transient && (err.status === 400 || err.status === 422)) {
        const rec = { planIdx: i, cls: entry.cls, setting: entry, status: err.status, body: err.json ?? null, at: now() };
        dataset.meta.rejected.push(rec); appendJsonlSafe(JOURNAL, { type: 'reject', rec });
        say(`  REJECTED ${entry.cls} (${err.status}) — recorded in meta.rejected, plan continues`);
        continue;
      }
      errors++; say(`  ERROR ${entry.cls}: ${err.message} (${errors}/8) — backing off 1.5 s`); save();
      if (err.status === 401) await client.refresh();
      if (errors >= 8) { console.log('  too many errors — saved, exiting. Re-run --resume.'); process.exit(1); }
      await sleep(1500); i--;
    }
  }
  if (placedOnPair > 0) pair = await closePair(hb, pair);
  dataset.meta.postCapture = { at: now(), activePair: scrub(await hb.seeds().catch(() => null)) };
  dataset.meta.totalBets = dataset.bets.length; dataset.meta.epochs = dataset.seeds.length; dataset.meta.finishedAt = now();
  dataset.meta.totalStaked = Math.round(dataset.bets.reduce((s, b) => s + Number(b.stake || 0), 0) * 1e8) / 1e8;
  save();
  const outFile = join(OUT, `housebets-${G}-${PHASE ? `phase${PHASE}${PSUF}` : 'sp1'}-${dataset.bets.length}bets.json`);
  writeJsonSafe(outFile, dataset);
  console.log(`\n── DONE ── ${dataset.bets.length}/${TOTAL} rounds · ${dataset.meta.rejected.length} rejected · ${dataset.seeds.length} epochs · anchor ${dataset.preCapture && dataset.preCapture.anchorOk} · staked ${dataset.meta.totalStaked}${PHASE ? ` · Phase ${PHASE}` : ''}`);
  console.log(`  dataset → ${outFile}`);
  runVerifier(outFile);
  }
}
