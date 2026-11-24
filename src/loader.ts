// Dataset pins and the population of record, stated as CODE next to the pin (the framework's G-BIND rule: a dataset
// that agrees with its own header proves nothing; the scored steps compare against these constants, never meta).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { Dataset } from './types.ts';

/** The package root: the nearest folder above this module holding package.json "housebets-limbo-audit" (works from src/
 *  under Node and from the bundled verify.js at the root). */
function findRoot(): string {
  let d = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i++) {
    const p = join(d, 'package.json');
    if (existsSync(p) && /"name":\s*"housebets-limbo-audit"/.test(readFileSync(p, 'utf8'))) return d;
    d = dirname(d);
  }
  throw new Error('package root not found');
}
export const ROOT = findRoot();
export const DATA = join(ROOT, 'data');

// Phase A primary: the 129 whole epochs of the 12 Oct 2026 capture (as-captured file split by scripts/split-whole-epochs.mjs)
export const PRIMARY_FILE = 'housebets-limbo-phaseA-6450bets.json';
export const PRIMARY_SHA256 = 'b18a02b7e1334d1f86c84248b5e25892b6e022f89804c1694ebe8ebb0afd803f';
export const TAIL_FILE = 'housebets-limbo-phaseA-tail-30bets.json';
export const TAIL_SHA256 = '50426eab9268df584394d62d564dfe095f34ec916227df40754e01cde121dd75';
// every dataset ships with the audit account's HouseBets user id replaced by "redacted"
// (scripts/redact-user-id.mjs; data/REDACTION.txt lists each as-captured file kept in the HouseBets workshop, with its
// sha256 next to the shipped sha256). The captured file in data/captured/ is the as-captured file with that one value
// replaced; the Phase A primary and tail are the split of it.
export const AS_CAPTURED_FILE = 'captured/housebets-limbo-sp1-6480bets.redacted.json';
export const AS_CAPTURED_SHA256 = '88acb2f0213655a9aa33dd96c789b9ad3b16bc5cec9f87352a302badf0ff0a4d';
// Supplementary phases (13 Oct 2026), each its own dataset and evidence id (audit-rules §2.5)
export const PHASE_C_FILE = 'supplementary/housebets-limbo-phaseC-250bets.json';
export const PHASE_C_SHA256 = 'b7a2278d0f1628faf2afed638e795dc4768c3af01a8c996b4c15f41261450582';
export const PHASE_C10_FILE = 'supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json';
export const PHASE_C10_SHA256 = '8c079aff19ed7932089096b9e4b907482104057020aa9c399945dc2757b15a8d';
export const PHASE_D_FILE = 'supplementary/housebets-limbo-phaseD-200bets.json';
export const PHASE_D_SHA256 = '8b0559985f2f7259bb7348afaecbff3300111ee6bd5e3d58df8a84b5a98e594e';

/** Evidence exhibits the steps read (E02/E04/E05/E06/E07) and the ones MANIFEST cites (all pinned, scripts/make-evidence.py). */
export const EVIDENCE_PINS: readonly (readonly [string, string])[] = [
  ['evidence/E01-limbo-fairness-spec-2026-10-12.json', '3cee869d7fc3b7f4d9aa4b4b728bafe9ab0339e272b902ac0eee47ed3063f233'],
  ['evidence/E02-limbo-rules-panel-2026-10-10.json', 'e14e9553b5761fad61e4ebdfe0f3465a78f4e7eda06252bbc3f864b90b7932f2'],
  ['evidence/E03-limbo-limits-2026-10-12.json', '668cd01db9e7e2759e57e60b1c90875ced488811a0226e42f5fc2d0f248fd351'],
  ['evidence/E04-limbo-bet-history-2026-10-13.json', '4cc5035a0540d58288ab5a30e8fac80de6741995aa417f508148db476b88ea51'],
  ['evidence/E05-account-reconcile-2026-10-13.txt', '0b9db018bfef380e6ce12fda89ba2a47556862c2f15083529d91491136ec5693'],
  ['evidence/E06-limbo-empty-seed-control-2026-10-13.json', '36d07217c0006c9eef9c0f9e34992d126e6b1220ec2a333b4e9db9160cf44686'],
  ['evidence/E07-limbo-rules-panel-live-2026-10-19.json', '20dc6cbe8e1107e74209989c56fcbc9f276b77957ca6e748f55940898d2d3d0f'],
];

// The population of record (G-BIND)
export const EXPECTED_BETS = 6450;
export const EXPECTED_SEEDS = 129;
export const EXPECTED_EPOCHS = 129;
export const EXPECTED_EPOCH_SIZE = 50;
export const EXPECTED_TAIL_BETS = 30;
export const EXPECTED_PHASE_C_BETS = 250;      // 5 epochs × 50, target 1.98, stake 100 × minimum
export const EXPECTED_PHASE_C10_BETS = 200;    // 4 epochs × 50, target 1.10, stake 10 (the $10 set)
export const EXPECTED_PHASE_D_BETS = 200;      // 4 epochs × 50, one player-set client seed per epoch
export const PHASE_C_STAKE = '1.000311';       // 100 × E03 minimum 0.01000311
export const PHASE_C_TARGET_H = 198;
export const PHASE_C10_STAKE = '10';
export const PHASE_C10_TARGET_H = 110;
export const PHASE_D_SEEDS = ['provablyfair-1', 'provablyfair-2', 'player-seed-abc', '1234567890'] as const;
/** This package's capture files as rows of the account reconciliation (E05), with their round counts. */
export const E05_ROWS: readonly (readonly [string, number])[] = [
  ["phaseA/housebets-limbo-sp1-6480bets.json", 6480],
  ["phases/housebets-limbo-phaseC-250bets.json", 250],
  ["phases/housebets-limbo-phaseD-200bets.json", 200],
  ["phases-10usd/housebets-limbo-phaseC-safe-10usd-200bets.json", 200],
];
export const NONCE_BASE = 1;   // HouseBets nonces start at 1 on a fresh pair (every epoch of the capture)
/** Phase A capture plan (FULL-CAPTURE-PLAN.md; planCounts): 4,680 random targets + 14 fixed targets at 130 slots each. */
export const PLAN_CLASSES = ['random', 'fixed-1.01', 'fixed-1.02', 'fixed-1.1', 'fixed-1.5', 'fixed-2', 'fixed-3', 'fixed-5', 'fixed-10', 'fixed-50',
  'fixed-100', 'fixed-1000', 'fixed-10000', 'fixed-100000', 'fixed-1000000'] as const;
export const PLAN_CLASS_FLOOR = 50;   // LIMBO-15: Phase A ≥ 50 bets per config class
/** LIMBO-15: the target decades the plan declares, 1× … 1,000,000× (the last holds only the cap), each ≥ 50 bets. */
export const PLAN_DECADES = [0, 1, 2, 3, 4, 5, 6] as const;
export const DECADE_FLOOR = 50;

export const sha256Bytes = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');
export const sha256File = (rel: string): string => sha256Bytes(readFileSync(join(ROOT, rel.startsWith('evidence/') || rel.startsWith('outputs/') ? rel : join('data', rel))));
export const load = (rel: string): Dataset => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as Dataset;
export const readJson = (rel: string): any => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
