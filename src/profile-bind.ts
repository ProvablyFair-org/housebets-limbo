// the step list is bound to the framework profile the MANIFEST cites.
// profile/profile.json is a byte copy of the framework's games/limbo/profile.public.json (version 1.0.4-public). Its sha256 must equal
// the pin the caller passes (tests/verify.ts PROFILE_PIN, the framework file's sha256) and PROFILE_SHA256 in
// src/profile-map.ts, and its version PROFILE_VERSION. Every check it lists must be in src/profile-map.ts with the same name,
// layer, kind and policy, and nothing else may be there. The scored list the verdict is bound to (EXPECTED_STEPS) and the
// policy each row is recorded under are taken from the vendored file, never from profile-map.ts, so deleting or relabelling
// a row there cannot shrink the list. A binding that does not hold withholds the verdict (INCOMPLETE, exit 3); a vendored
// file that is not the pinned one is also a pin failure (LIMBO-26).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT } from './loader.ts';
import { PROFILE, PROFILE_SHA256, PROFILE_VERSION, type ProfileCheck } from './profile-map.ts';

export const PROFILE_FILE = 'profile/profile.json';
export interface ProfileBinding {
  ok: boolean; fileOk: boolean; fileSha256: string | null; version: string | null; checks: ProfileCheck[]; scored: string[];
  missing: string[]; relabelled: string[]; differs: string[]; extra: string[]; detail: string;
}
const isScored = (c: { policy: string }) => c.policy === 'HARD_FAIL' || c.policy === 'FLAG';

export function bindProfile(pin: string): ProfileBinding {
  const p = join(ROOT, PROFILE_FILE);
  let fileSha256: string | null = null, json: any = null;
  if (existsSync(p)) { const b = readFileSync(p); fileSha256 = createHash('sha256').update(b).digest('hex'); try { json = JSON.parse(b.toString('utf8')); } catch { json = null; } }
  const version: string | null = json?.profileVersion ?? null;
  const fileOk = fileSha256 === pin && pin === PROFILE_SHA256 && version === PROFILE_VERSION && json?.game === 'limbo' && Array.isArray(json?.checks);
  const checks: ProfileCheck[] = fileOk ? json.checks.map((c: any) => ({ id: c.id, name: c.name, layer: c.layer, kind: c.kind, policy: c.policy })) : [];
  const missing: string[] = [], relabelled: string[] = [], differs: string[] = [];
  for (const c of checks) {
    const r = PROFILE.find((x) => x.id === c.id);
    if (!r) { missing.push(c.id); continue; }
    if (r.policy !== c.policy) relabelled.push(`${c.id} ${c.policy} → ${r.policy}`);
    if (r.name !== c.name || r.layer !== c.layer || r.kind !== c.kind) differs.push(c.id);
  }
  const extra = fileOk ? PROFILE.filter((r) => !checks.some((c) => c.id === r.id)).map((r) => r.id) : [];
  const ok = fileOk && missing.length === 0 && relabelled.length === 0 && differs.length === 0 && extra.length === 0;
  // the scored list: the vendored file's when it is the pinned one; otherwise the union of whatever both sources score, so a
  // tampered file can only add expected steps, never remove one (and the verdict is withheld anyway)
  const fileScored = Array.isArray(json?.checks) ? json.checks.filter(isScored).map((c: any) => String(c.id)) : [];
  const scored = fileOk ? checks.filter(isScored).map((c) => c.id) : [...new Set([...fileScored, ...PROFILE.filter(isScored).map((c) => c.id)])];
  const detail = `${PROFILE_FILE} sha256 ${fileSha256 ? fileSha256.slice(0, 12) + '…' : 'ABSENT'} == the pinned framework profile ${pin.slice(0, 12)}… == PROFILE_SHA256 (src/profile-map.ts) ${PROFILE_SHA256.slice(0, 12)}…, version ${version ?? '?'} == ${PROFILE_VERSION}: ${fileOk}; `
    + `src/profile-map.ts rows == the vendored profile (id, name, layer, kind, policy): ${checks.filter((c) => PROFILE.some((r) => r.id === c.id && r.name === c.name && r.layer === c.layer && r.kind === c.kind && r.policy === c.policy)).length}/${checks.length}`
    + `${missing.length ? `; rows missing from profile-map.ts: ${missing.join(', ')}` : ''}${relabelled.length ? `; policy relabelled: ${relabelled.join(', ')}` : ''}`
    + `${differs.length ? `; name/layer/kind differ: ${differs.join(', ')}` : ''}${extra.length ? `; rows not in the profile: ${extra.join(', ')}` : ''}; scored checks of the profile: ${scored.length}`;
  return { ok, fileOk, fileSha256, version, checks, scored, missing, relabelled, differs, extra, detail };
}
