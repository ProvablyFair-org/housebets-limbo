#!/usr/bin/env node
// The falsifiability battery (-29): every mutation in tests/mutations.json is applied to a throwaway copy of the package,
// verify runs there, and the mutation is KILLED when the check it names leaves the status it has in an UNMUTATED control
// copy run the same way: an aborted check (no row printed: MISSING) or a harness error counts as a survivor. The control
// must itself reproduce the committed verification record's scored statuses, or the battery fails.
// 'repin': true re-pins the mutated file's sha256 everywhere in src/ and RELEASE-MANIFEST.json (a forgery that keeps the
// pins green); 'repinPackage': true (with 'repin') also replaces that sha256 in the copy's MANIFEST.md and README.md, so no pin and no
// quoted hash can catch the change; 'regen' (one name or a list, run in order) re-generates an artifact of record in the copy and re-pins it, as an
// adversary who also re-ran the package's own scripts would: 'simulate' the census, 'rtp-table' the RTP table
// (src/rtp-settings.ts), 'record' the verification record (verify run in the copy, outputs/run → outputs/). 'parts' applies
// several edits, each to its own file (a step deleted from tests/verify.ts AND its row from src/profile-map.ts).
// 'expectExit' (a code or a list): the mutation is killed only when the run also ends in that exit (an RTP miss
// with the RTP table and record regenerated must end in 5, the same change unregenerated in 1; a missing step in 3), so a
// mutation cannot be counted killed by the wrong verdict. After any change to the sources, the copy's
// verify.js header digest is refreshed, as an adversary who also rebuilt the bundle would, so a stale-bundle failure of
// -27 cannot pass for a kill.
// Writes outputs/run/mutation-results.json (this run, with timings) and outputs/mutation-results.json (the committed record,
// deterministic, bound to tests/mutations.json and to the sources by sha256; pinned in RELEASE-MANIFEST.json).
// Runs PF_MUT_JOBS copies at a time (default 6).
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { sourcesSha256 } from './build-standalone.mjs';

const GAME = 'limbo';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const regText = readFileSync(join(ROOT, 'tests', 'mutations.json'));
const reg = JSON.parse(regText.toString('utf8'));
const only = process.argv.slice(2);
const list = reg.mutations.filter((m) => !only.length || only.includes(m.id));
const JOBS = Number(process.env.PF_MUT_JOBS || 6);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const committed = new Map(JSON.parse(readFileSync(join(ROOT, 'outputs', 'verification-results.json'), 'utf8')).steps.map((x) => [x.id, x.status + (x.origin === 'capture' ? '*' : '')]));
const NODE = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/ts-resolve.mjs'];
const DIGEST_RE = /(Sources sha256 \(tests\/verify\.ts \+ src\/\*\.ts\): )([0-9a-f]{64})/;

function walk(obj, path) {   // "bets[7]._raw.round.payout" -> [parent, key]
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let o = obj; for (const p of parts.slice(0, -1)) o = o[p];
  return [o, parts[parts.length - 1]];
}
const addDec = (x, d) => { const s = typeof x === 'string'; const v = Math.round((Number(x) + d) * 1e8) / 1e8; return s ? v.toFixed(8) : v; };
// 'rm' deletes 'file' from the copy (an artifact of record that is simply absent). 'truncate' keeps the first
// floor(n * value) records of the array at 'path' and, with 'coherent', sets every other count in the file that equalled n to
// the new length (a population shrink with a header that agrees). 'null' sets each of 'keys' to null in every record of the
// array at 'path' (every reveal withheld). Added 30 Oct 2026: a verifier that throws on one of these prints no row for the
// check it names, and this battery scores that as a survivor.
function truncateAt(root, arr, value, coherent) {
  if (!Array.isArray(arr)) throw new Error('truncate: path is not an array');
  const n0 = arr.length, n1 = Math.floor(n0 * value); arr.length = n1;
  if (coherent) (function fix(o) { if (!o || typeof o !== 'object' || o === arr) return; for (const q of Object.keys(o)) { if (o[q] === n0) o[q] = n1; else if (o[q] === String(n0)) o[q] = String(n1); else fix(o[q]); } })(root);
}
function nullKeys(arr, keys) {
  if (!Array.isArray(arr)) throw new Error('null: path is not an array');
  let n = 0; for (const r of arr) for (const q of keys) if (r && typeof r === 'object' && q in r) { r[q] = null; n++; }
  if (!n) throw new Error('null: no record carries ' + keys.join('/'));
}
function repinAll(dir, oldSha, newSha) {
  const targets = [...readdirSync(join(dir, 'src')).map((f) => join(dir, 'src', f)), join(dir, 'RELEASE-MANIFEST.json')];
  for (const p of targets) { if (!existsSync(p)) continue; const t = readFileSync(p, 'utf8'); if (t.includes(oldSha)) writeFileSync(p, t.split(oldSha).join(newSha)); }
}
function refreshBundleDigest(dir) {
  const p = join(dir, 'verify.js'); if (!existsSync(p)) return;
  const t = readFileSync(p, 'utf8'); const now = sourcesSha256(dir);
  if (DIGEST_RE.test(t)) writeFileSync(p, t.replace(DIGEST_RE, `$1${now}`));
}
const run = (dir, args) => new Promise((res) => { const c = spawn(process.execPath, [...NODE, ...args], { cwd: dir }); let out = ''; c.stdout.on('data', (d) => out += d); c.stderr.on('data', (d) => out += d); c.on('close', (code) => res({ code, out })); });
const statuses = (out) => new Map(out.split('\n').filter((l) => /^\s+[A-Z]+-\d+\s/.test(l)).map((l) => { const [id, st] = l.trim().split(/\s+/); return [id, st]; }));

async function inCopy(tag, mutateFn) {
  const dir = mkdtempSync(join(tmpdir(), `hb${GAME}-${tag}-`));
  try {
    cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(join('outputs', 'run')) && !s.includes('node_modules') });
    const srcBefore = sourcesSha256(dir);
    await mutateFn(dir);
    if (sourcesSha256(dir) !== srcBefore) refreshBundleDigest(dir);
    const { code, out } = await run(dir, ['tests/verify.ts']);
    return { code, out };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function applyMutation(dir, m) {
  for (const part of m.parts || [m]) await applyEdit(dir, { id: m.id, ...part });
  for (const g of [].concat(m.regen || [])) await regen(dir, m.id, g);
}
const ARTIFACT = { simulate: ['outputs/simulation-results.json', ['src/simulate.ts'], { PF_EMIT: '1' }], 'rtp-table': ['outputs/rtp-claim-table.json', ['src/rtp-settings.ts'], {}] };
async function regen(dir, id, g) {
  if (g === 'record') {   // the verification record: verify in the copy, then its run record becomes the committed one
    const rel = 'outputs/verification-results.json', old = sha(readFileSync(join(dir, rel)));
    await run(dir, ['tests/verify.ts']);
    const fresh = join(dir, 'outputs', 'run', 'verification-results.json'); if (!existsSync(fresh)) throw new Error(`${id}: record regen wrote nothing`);
    writeFileSync(join(dir, rel), readFileSync(fresh)); repinAll(dir, old, sha(readFileSync(join(dir, rel)))); return;
  }
  const a = ARTIFACT[g]; if (!a) throw new Error(`${id}: unknown regen ${g}`);
  const old = sha(readFileSync(join(dir, a[0])));
  const r = await new Promise((res) => { const c = spawn(process.execPath, [...NODE, ...a[1]], { cwd: dir, env: { ...process.env, ...a[2] } }); c.on('close', res); });
  if (r !== 0) throw new Error(`${id}: ${g} failed`);
  repinAll(dir, old, sha(readFileSync(join(dir, a[0]))));
}
async function applyEdit(dir, m) {
  const fp = join(dir, m.file); const before = readFileSync(fp);
  if (m.op === 'rm') rmSync(fp);
    else if (m.op === 'text') {
    let t = before.toString('utf8');
    for (const e of m.edits || [{ find: m.find, replace: m.replace }]) { if (!t.includes(e.find)) throw new Error(`${m.id}: text not found: ${e.find.slice(0, 60)}`); t = t.replace(e.find, e.replace); }
    writeFileSync(fp, t);
  } else {
    const obj = JSON.parse(before.toString('utf8'));
    for (const p of m.paths || [m.path]) {
      const [o, k] = walk(obj, p);
      if (m.op === 'set') o[k] = m.value; else if (m.op === 'add') o[k] = addDec(o[k], m.value); else if (m.op === 'delete') o.splice(Number(k), 1); else if (m.op === 'truncate') truncateAt(obj, o[k], m.value, m.coherent); else if (m.op === 'null') nullKeys(o[k], m.keys);
    }
    writeFileSync(fp, JSON.stringify(obj, null, 2) + (before.toString('utf8').endsWith('\n') ? '\n' : ''));
  }
  if (m.repin) repinAll(dir, sha(before), sha(readFileSync(fp)));
  if (m.repinPackage) {   // the forgery follows the file's sha256 into the two documents that quote it too ('repin' above covers src/ and RELEASE-MANIFEST.json)
    for (const f of ['MANIFEST.md', 'README.md']) {
      const pp = join(dir, f); const pt = readFileSync(pp, 'utf8');
      if (!pt.includes(sha(before))) throw new Error(`${m.id}: the sha256 of ${m.file} is not in ${f}`);
      writeFileSync(pp, pt.split(sha(before)).join(sha(readFileSync(fp))));
    }
    if (!readFileSync(join(dir, 'RELEASE-MANIFEST.json'), 'utf8').includes(sha(readFileSync(fp)))) throw new Error(`${m.id}: RELEASE-MANIFEST.json does not hold the re-pinned sha256 of ${m.file}`);
  }
}

// the unmutated control: its statuses are the baseline every kill is measured against
const control = await inCopy('control', async () => {});
const base = statuses(control.out);
const mismatches = [...committed.entries()].filter(([id, st]) => base.get(id) !== st).map(([id, st]) => `${id}: committed ${st}, control ${base.get(id) ?? 'MISSING'}`);
const controlRec = { ok: mismatches.length === 0 && control.code === 0, exit: control.code, mismatches };
console.log(`  control (unmutated copy): exit ${control.code}; scored statuses == the committed record: ${mismatches.length === 0}${mismatches.length ? ' — ' + mismatches.join('; ') : ''}`);

async function one(m) {
  const t0 = Date.now();
  try {
    const { code, out } = await inCopy(m.id, (dir) => applyMutation(dir, m));
    const status = statuses(out).get(m.kills) ?? 'MISSING';
    const verdict = (out.match(/VERDICT: (.+)/) || [])[1] || 'none';
    const baseline = base.get(m.kills) ?? 'MISSING';
    const exitOk = m.expectExit === undefined || [].concat(m.expectExit).includes(code);
    return { id: m.id, kills: m.kills, what: m.what, status, baseline, killed: status !== baseline && status !== 'MISSING' && status !== 'ERROR' && exitOk, verdict, exit: code,
      ...(m.expectExit !== undefined ? { expectExit: m.expectExit } : {}), seconds: Math.round((Date.now() - t0) / 1000) };
  } catch (e) { return { id: m.id, kills: m.kills, what: m.what, status: 'ERROR', baseline: base.get(m.kills) ?? 'MISSING', killed: false, verdict: 'none', exit: null, error: String(e.message) }; }
}

const results = new Map(); let next = 0;
await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, async () => { while (next < list.length) { const m = list[next++]; const r = await one(m); results.set(m.id, r); console.log(`  ${r.id.padEnd(5)} ${r.kills}  ${r.killed ? 'KILLED' : 'SURVIVED'} (${r.baseline} -> ${r.status}; ${r.verdict}; exit ${r.exit}${r.expectExit !== undefined ? ` (must be ${[].concat(r.expectExit).join(' or ')})` : ''}${r.error ? '; ' + r.error : ''})  ${r.what}`); } }));
const ordered = list.map((m) => results.get(m.id));   // registry order
// every scored check (HARD_FAIL / FLAG) of the profile must have at least one killing mutation — the scored list of the
// vendored framework profile (profile/profile.json), not of src/profile-map.ts
const scored = JSON.parse(readFileSync(join(ROOT, 'profile', 'profile.json'), 'utf8')).checks.filter((c) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG').map((c) => c.id);
const uncoveredSteps = only.length ? [] : scored.filter((id) => !ordered.some((r) => r.kills === id && r.killed));
const survivors = ordered.filter((r) => !r.killed).map((r) => ({ id: r.id, kills: r.kills, status: r.status, limitation: null }));
const runOut = { total: ordered.length, killed: ordered.filter((r) => r.killed).length, survivors, uncoveredSteps, control: controlRec, results: ordered };
mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
writeFileSync(join(ROOT, 'outputs', 'run', 'mutation-results.json'), JSON.stringify(runOut, null, 2) + '\n');
if (!only.length) {   // the committed record: no timings, bound to the registry and the sources
  const rec = { about: `npm run mutate (scripts/mutate.mjs) over tests/mutations.json; a mutation is killed when its named check leaves the unmutated control copy's status`,
    registrySha256: sha(regText), sourcesSha256: sourcesSha256(ROOT), scriptSha256: sha(readFileSync(fileURLToPath(import.meta.url))), node: process.versions.node,
    total: runOut.total, killed: runOut.killed, survivors, uncoveredSteps, control: controlRec,
    results: ordered.map(({ seconds, ...r }) => r) };
  writeFileSync(join(ROOT, 'outputs', 'mutation-results.json'), JSON.stringify(rec, null, 2) + '\n');
}
console.log(`mutations: ${runOut.killed}/${runOut.total} killed; survivors ${survivors.length}; scored checks with no killing mutation: ${uncoveredSteps.join(', ') || 'none'}; control ${controlRec.ok ? 'OK' : 'DIFFERS'}`);
process.exitCode = survivors.length || uncoveredSteps.length || !controlRec.ok ? 1 : 0;
