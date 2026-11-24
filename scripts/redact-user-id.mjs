#!/usr/bin/env node
// usage: node scripts/redact-user-id.mjs <capture.json> <out.json>
// The capture's raw server answers carry the audit
// account's HouseBets user id (bets[]._raw.game.userId; the other userId fields hold the nil UUID). No check uses it.
// This replaces that one value with the string "redacted" as a pure text substitution of the quoted value: no parse and
// re-serialise, so every other byte of the file is unchanged. The value is found IN the file (the string values of every
// "userId" key other than the nil UUID; exactly one distinct value is required); this script never contains it and never
// prints it. Anyone holding the as-captured file (HouseBets workshop, sha256 in data/REDACTION.txt) reproduces the shipped
// bytes with this script.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

const NIL = '00000000-0000-0000-0000-000000000000';
const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node scripts/redact-user-id.mjs <capture.json> <out.json>'); process.exit(2); }
const sha = (s) => createHash('sha256').update(s).digest('hex');
const text = readFileSync(src, 'utf8');
const parsed = JSON.parse(text);
const ids = new Set(); let keys = 0;
(function walk(o) {
  if (Array.isArray(o)) { for (const v of o) walk(v); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'userId' && typeof v === 'string') { keys++; if (v !== NIL && v !== 'redacted') ids.add(v); }
    walk(v);
  }
})(parsed);
if (ids.size !== 1) throw new Error(`expected exactly 1 distinct non-nil userId value, found ${ids.size}`);
const [id] = ids;
const quotedId = JSON.stringify(id);
const bare = text.split(id).length - 1, quoted = text.split(quotedId).length - 1;
if (bare !== quoted) throw new Error('the value also appears outside a quoted JSON string; refusing a text substitution');
const out = text.split(quotedId).join('"redacted"');
if (out.includes(id)) throw new Error('the value is still present after the substitution');
// The capture rig writes JSON.stringify(obj, null, 2) (src/split.ts proves it on the capture file). If the input
// round-trips through that call, the output must too: the substitution changed one string value and nothing else.
const rtIn = JSON.stringify(parsed, null, 2) === text, rtOut = JSON.stringify(JSON.parse(out), null, 2) === out;
if (rtIn !== rtOut) throw new Error('the redacted bytes no longer round-trip through the rig serialiser');
writeFileSync(dst, out);
console.log(JSON.stringify({ in: basename(src), inSha256: sha(text), out: basename(dst), outSha256: sha(out), userIdKeys: keys, replaced: quoted, roundTrip: rtOut }));
