#!/usr/bin/env node
// usage: node --experimental-strip-types scripts/split-whole-epochs.mjs <captured.json> <outdir> <game>   (logic: src/split.ts)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { splitWholeEpochs } from '../src/split.ts';
const [src, outdir, game] = process.argv.slice(2);
if (!src || !outdir || !game) { console.error('usage: node --experimental-strip-types scripts/split-whole-epochs.mjs <captured.json> <outdir> <game>'); process.exit(2); }
const sha = (s) => createHash('sha256').update(s).digest('hex');
const text = readFileSync(src, 'utf8');
const r = splitWholeEpochs(text, basename(src), game);
mkdirSync(outdir, { recursive: true });
writeFileSync(join(outdir, r.primaryName), r.primaryText);
const lines = [`captured    ${basename(src)} ${sha(text)}`, `primary     ${r.primaryName} ${sha(r.primaryText)}`];
if (r.tailName) { writeFileSync(join(outdir, r.tailName), r.tailText); lines.push(`tail        ${r.tailName} ${sha(r.tailText)}`); }
console.log(lines.join('\n'));
