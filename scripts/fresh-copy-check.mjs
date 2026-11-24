#!/usr/bin/env node
// -28 release gate, as far as a working copy allows: copy the package (no outputs/run, no node_modules) to a fresh temporary
// folder, run the full test there (RNG vectors + verify) and the standalone verify.js, regenerate the census into
// outputs/run/, compare it with the committed one field by field (integers and strings exact, other numbers within
// 1e-14 + 1e-12·max|·|), and check that no pinned artifact or dataset changed. Writes outputs/run/fresh-copy.json (this run,
// with its runtime) and outputs/run/diff.json, and the committed record outputs/fresh-copy.json (deterministic: no runtime;
// bound to the sources, to verify.js and to this script by sha256; pinned in RELEASE-MANIFEST.json). A git clone + `npm ci` is the
// release-time form of this check.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, mkdtempSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { gateFailures } from './fresh-copy-gate.mjs';
import { sourcesSha256 } from './build-standalone.mjs';

const GAME = 'limbo';
const CLEAN = 'PROVABLY FAIR — Full Pass';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NODE = ['--experimental-strip-types', '--no-warnings', '--import', './scripts/ts-resolve.mjs'];
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const files = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : [p]; });
const dir = mkdtempSync(join(tmpdir(), `hb${GAME}-fresh-`));
cpSync(ROOT, dir, { recursive: true, filter: (s) => !s.includes(join('outputs', 'run')) && !s.includes('node_modules') });
const tracked = [...files(join(dir, 'data')), ...files(join(dir, 'evidence')),
  ...['simulation-results.json', 'rtp-claim-table.json', 'verification-results.json', 'mutation-results.json', 'fresh-copy.json'].map((f) => join(dir, 'outputs', f)).filter((p) => existsSync(p))];
const before = new Map(tracked.map((p) => [p, sha(p)]));

const t0 = Date.now();
const rng = spawnSync(process.execPath, [...NODE, '--test', 'tests/rng.test.ts'], { cwd: dir, encoding: 'utf8' });
const ver = spawnSync(process.execPath, [...NODE, 'tests/verify.ts'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 });
const std = existsSync(join(dir, 'verify.js')) ? spawnSync(process.execPath, ['verify.js'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 26 }) : null;
const sim = spawnSync(process.execPath, [...NODE, 'src/simulate.ts'], { cwd: dir, encoding: 'utf8' });

function diff(a, b, path = '', out = []) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isInteger(a) && Number.isInteger(b) ? a !== b : Math.abs(a - b) > 1e-14 + 1e-12 * Math.max(Math.abs(a), Math.abs(b))) out.push({ path, committed: a, run: b });
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], path ? `${path}.${k}` : k, out);
  } else if (a !== b) out.push({ path, committed: a, run: b });
  return out;
}
const regen = join(dir, 'outputs', 'run', 'simulation-results.json');
const d = existsSync(regen) ? diff(JSON.parse(readFileSync(join(dir, 'outputs', 'simulation-results.json'), 'utf8')), JSON.parse(readFileSync(regen, 'utf8'))) : [{ path: '(no regeneration)' }];
const changed = tracked.filter((p) => sha(p) !== before.get(p)).map((p) => relative(dir, p));
const verdict = (ver.stdout.match(/VERDICT: (.+)/) || [])[1] || null;
const stdVerdict = std ? (std.stdout.match(/VERDICT: (.+)/) || [])[1] || null : null;
const result = { node: process.versions.node, rngTestsExit: rng.status, exit: ver.status, verdict, standaloneExit: std ? std.status : null, standaloneVerdict: stdVerdict,
  cleanVerdict: verdict === CLEAN && stdVerdict === CLEAN, reproduced: /REPRODUCED/.test(ver.stdout), simulateExit: sim.status, beyondTolerance: d.length,
  pinnedUnchanged: changed.length === 0, changed, sourcesSha256: sourcesSha256(dir), scriptSha256: sha(fileURLToPath(import.meta.url)), verifyJsSha256: existsSync(join(dir, 'verify.js')) ? sha(join(dir, 'verify.js')) : null };
const seconds = Math.round((Date.now() - t0) / 1000);
mkdirSync(join(ROOT, 'outputs', 'run'), { recursive: true });
writeFileSync(join(ROOT, 'outputs', 'run', 'diff.json'), JSON.stringify({ node: process.versions.node, artifact: 'outputs/simulation-results.json', fieldsBeyondTolerance: d }, null, 2) + '\n');
writeFileSync(join(ROOT, 'outputs', 'run', 'fresh-copy.json'), JSON.stringify({ ...result, seconds }, null, 2) + '\n');
// The pass rule is scripts/fresh-copy-gate.mjs: both verifiers ran, each with the committed record's verdict, its exit code
// and a confirmed reproduction. Only a passing run replaces the committed record; a failed run is kept in outputs/run/.
const EXPECTED_VERDICT = JSON.parse(readFileSync(join(ROOT, 'outputs', 'verification-results.json'), 'utf8')).verdict;
const failures = gateFailures({ ...result, standaloneVerdict: stdVerdict, standaloneReproduced: std ? /REPRODUCED/.test(std.stdout) : null }, EXPECTED_VERDICT);
if (failures.length === 0) writeFileSync(join(ROOT, 'outputs', 'fresh-copy.json'), JSON.stringify(result, null, 2) + '\n');
else writeFileSync(join(ROOT, 'outputs', 'run', 'fresh-copy-failed.json'), JSON.stringify({ failures, expectedVerdict: EXPECTED_VERDICT, result }, null, 2) + '\n');
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify({ ...result, seconds }, null, 2));
if (failures.length) console.error(`fresh-copy gate FAILED: outputs/fresh-copy.json left as it was, this run kept in outputs/run/fresh-copy-failed.json\n  - ${failures.join('\n  - ')}`);
process.exitCode = failures.length ? 1 : 0;
