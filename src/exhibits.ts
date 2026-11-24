// the published figures are read at verify time from the pinned exhibits, not from a
// hand copy. verify checks every exhibit's sha256 first (LIMBO-26, src/loader.ts EVIDENCE_PINS) and only then calls this.
//   E01  the fairness answer (GET /housegames/limbo/fairness): formula, range, worked examples, houseEdge, the summary text
//   E02  the rules panel text and the constants of the game's page code (bundle platform-housegames-limbo-game.js, 10 Oct
//        copy: the bundle in force while the rounds were captured)
//   E07  the rules panel text in the live copy of the same bundle (fetched 19 Oct 2026, last-modified 16 Oct 2026): the RTP
//        line was reworded on 16 Oct; both wordings are places the figure is stated
//   E03  the limits answer (GET /housegames/limits/limbo): wallet minimum stake, maximum win, decimals
// Two kinds of figure come out of here:
//   - the RTP CLAIM, from every place our evidence states it: the rules (E02 and E07 rulesRtpLine) and the game settings the
//     site loads (E01 houseEdge and its summary sentence). It is never a src/ constant: it goes to the RTP-CLAIM rule, so a
//     raised figure is an RTP miss (LIMBO-19 OVERSTATED, exit 5), not a reproduction failure.
//   - the ALGORITHM AND LIMIT constants the hot paths keep in src/spec.ts (bundle size, speed). Each is compared here with the
//     value parsed from its exhibit; a mismatch is listed and fails LIMBO-26 (a reproduction failure, exit 1). The steps
//     that cite an exhibit value (LIMBO-09 vectors, LIMBO-12 minimum stake, LIMBO-14 maximum win, LIMBO-13/18 numerator)
//     take it from here.
import { readJson } from './loader.ts';
import { decimalText } from './rules.ts';
import { SCALE, MIN_RESULT_H, MAX_RESULT_H, HOUSE_EDGE, TWO32, NUMERATOR, MIN_TARGET_H, MAX_TARGET_H, DEFAULT_TARGET_H, WIN_RULE_TEXT,
  FORMULA_TEXT, MAX_WIN, MIN_STAKE, WALLET_DECIMALS, SPEC_VECTORS } from './spec.ts';

export const E01_FILE = 'evidence/E01-limbo-fairness-spec-2026-10-12.json';
export const E02_FILE = 'evidence/E02-limbo-rules-panel-2026-10-10.json';
export const E03_FILE = 'evidence/E03-limbo-limits-2026-10-12.json';
export const E07_FILE = 'evidence/E07-limbo-rules-panel-live-2026-10-19.json';

/** One place our evidence states the RTP figure. `rtp` is the figure as an exact decimal fraction of 1 ("0.99"), or null
 *  when the text no longer states one in the form it was read in. */
export interface ClaimPlace { place: 'rules' | 'game settings'; exhibit: string; field: string; text: string; rtp: string | null }
export interface Vector { serverSeed: string; clientSeed: string; nonce: number; draw: number; resultH: number }
export interface Exhibits {
  places: ClaimPlace[];
  /** The figure the rule tests: the highest one stated across the places (the strongest claim made to a player). */
  claimRtp: string | null;
  claimSource: string;
  placesAgree: boolean;
  vectors: Vector[];
  minStake: string; maxWin: string; maxBet: string;
  numerator: number; houseEdgeFormula: number; winChanceNumerator: number | null;
  /** src/spec.ts constants that differ from their exhibit value (a reproduction failure, LIMBO-26). */
  mismatches: string[];
  /** the number of src/spec.ts constants compared with an exhibit value */
  compared: number;
}

/** "99" (percent) → "0.99"; "99.5" → "0.995"; exact decimal shift, trailing zeros dropped. */
export function percentToFraction(pct: string): string {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(pct.trim()); if (!m) throw new Error(`not a percentage: ${pct}`);
  const int = m[1].replace(/^0+(?=\d)/, ''), frac = m[2] ?? '';
  const digits = (int + frac).replace(/^0+(?=\d)/, '');
  const scale = frac.length + 2;   // the value is digits / 10^scale
  const s = digits.padStart(scale + 1, '0');
  const out = `${s.slice(0, s.length - scale)}.${s.slice(s.length - scale)}`.replace(/0+$/, '').replace(/\.$/, '');
  return out;
}
/** 1 − houseEdge as an exact decimal ("0.01" → "0.99"). */
export function oneMinus(x: number | string): string {
  const s = decimalText(x); const m = /^(\d+)(?:\.(\d+))?$/.exec(s); if (!m) throw new Error(`not a non-negative decimal: ${s}`);
  const frac = m[2] ?? '', scale = frac.length, v = BigInt(m[1] + frac), one = 10n ** BigInt(scale), r = one - v;
  if (r < 0n) throw new Error(`house edge above 1: ${s}`);
  const t = r.toString().padStart(scale + 1, '0');
  return scale ? `${t.slice(0, t.length - scale)}.${t.slice(t.length - scale)}`.replace(/0+$/, '').replace(/\.$/, '') : t;
}
/** decimalText that never throws: an unreadable value becomes 'unreadable' (and then differs from every constant). */
const dec = (x: unknown): string => { try { return decimalText(x as number | string); } catch { return 'unreadable'; } };
const cmpDec = (a: string, b: string): number => {   // exact comparison of two non-negative decimals
  const [ai, af = ''] = a.split('.'), [bi, bf = ''] = b.split('.'); const n = Math.max(af.length, bf.length);
  const x = BigInt(ai + af.padEnd(n, '0')), y = BigInt(bi + bf.padEnd(n, '0')); return x < y ? -1 : x > y ? 1 : 0;
};

export function readExhibits(): Exhibits {
  const e1 = readJson(E01_FILE), e2 = readJson(E02_FILE), e3 = readJson(E03_FILE), e7 = readJson(E07_FILE);
  const b1 = e1.answer?.body ?? {}, panel = e2.rulesPanelEnglish ?? {}, wallet = e3.answer?.body?.wallet ?? {};
  const mismatches: string[] = []; let compared = 0;
  const same = (label: string, src: unknown, ex: unknown) => { compared++; if (String(src) !== String(ex)) mismatches.push(`${label}: src ${String(src)} != exhibit ${String(ex)}`); };

  // ── the RTP claim, every place it is stated ──
  const places: ClaimPlace[] = [];
  const rtpLine = String(panel.rulesRtpLine ?? '');
  const mR = /RTP is (\d+(?:\.\d+)?)%/.exec(rtpLine);
  places.push({ place: 'rules', exhibit: 'E02', field: 'rulesPanelEnglish.rulesRtpLine', text: rtpLine, rtp: mR ? percentToFraction(mR[1]) : null });
  const liveLine = String(e7.rulesPanelEnglish?.rulesRtpLine ?? '');
  const mL = /^Theoretical RTP before payout rounding: (\d+(?:\.\d+)?)%/.exec(liveLine);
  places.push({ place: 'rules', exhibit: 'E07', field: 'rulesPanelEnglish.rulesRtpLine', text: liveLine, rtp: mL ? percentToFraction(mL[1]) : null });
  let heRtp: string | null = null; try { if (typeof b1.houseEdge === 'number' || typeof b1.houseEdge === 'string') heRtp = oneMinus(b1.houseEdge); } catch { heRtp = null; }
  places.push({ place: 'game settings', exhibit: 'E01', field: 'answer.body.houseEdge', text: `houseEdge ${b1.houseEdge}`, rtp: heRtp });
  const summary = String(b1.summary ?? '');
  const mS = /A target t is reached with probability (\d+(?:\.\d+)?) \/ t: a (\d+(?:\.\d+)?)% edge at every target\./.exec(summary);
  const sentence = mS ? mS[0] : '';
  places.push({ place: 'game settings', exhibit: 'E01', field: 'answer.body.summary', text: sentence, rtp: mS ? dec(mS[1]) : null });
  const stated = places.map((p) => p.rtp).filter((x): x is string => x !== null);
  const claimRtp = stated.length ? stated.reduce((a, b) => (cmpDec(a, b) >= 0 ? a : b)) : null;
  const placesAgree = stated.length === places.length && stated.every((x) => cmpDec(x, stated[0]) === 0);
  const bundle = `bundle ${String(e2.source?.file ?? '?').split(' ')[0].split('/').pop()} sha256 ${String(e2.source?.sha256 ?? '?').slice(0, 8)}…, checked on the live page ${String(e2.source?.checkedOnLivePage ?? '?')}`;
  const live = `bundle sha256 ${String(e7.source?.sha256 ?? '?').slice(0, 8)}…, last-modified ${String(e7.source?.lastModified ?? '?')}, fetched ${String(e7.source?.fetchedAt ?? '?')}`;
  const claimSource = `HouseBets limbo; the figure is stated in two of the rule's places in our evidence. The rules: the rules panel text in the game's page code (E02 rulesRtpLine "${rtpLine}"; ${bundle}; the rendered panel was not captured, P-2), reworded in the live copy of the same bundle (E07 rulesRtpLine "${liveLine}"; ${live}). The game settings the site loads: the fairness answer (E01 GET /housegames/limbo/fairness, read by the capture ${String(e1.answer?.at ?? '?').slice(0, 10)}: houseEdge ${b1.houseEdge}; "${sentence}")`
    + (placesAgree ? '' : `. The places do not state one figure (${places.map((p) => `${p.exhibit} ${p.field.split('.').pop()} ${p.rtp ?? 'none'}`).join(', ')}): the highest is tested`);

  // ── algorithm constants: E01 ──
  same('SCALE (E01 scale)', SCALE, b1.scale);
  same('MIN_RESULT_H (E01 min × scale)', MIN_RESULT_H, Number(b1.min) * Number(b1.scale));
  same('MAX_RESULT_H (E01 max × scale)', MAX_RESULT_H, Number(b1.max) * Number(b1.scale));
  compared++; if (!summary.includes(FORMULA_TEXT)) mismatches.push('FORMULA_TEXT: not in the E01 summary');
  const fNum = (/floor\(1e8 \/ \(float x 1e8\) x (\d+(?:\.\d+)?) x 100\)/.exec(summary) || [])[1];
  same('1 − HOUSE_EDGE (the E01 formula\'s factor)', oneMinus(HOUSE_EDGE), fNum ?? 'absent');
  same('win rule (E01 winRule)', 'result >= target', b1.winRule);
  const vectors: Vector[] = (Array.isArray(b1.vectors) ? b1.vectors : []).map((v: any) => ({ serverSeed: String(v.serverSeed), clientSeed: String(v.clientSeed), nonce: Number(v.nonce), draw: Number(v.draw), resultH: Math.round(Number(v.result) * 100) }));
  same('SPEC_VECTORS (E01 vectors)', JSON.stringify(SPEC_VECTORS), JSON.stringify(vectors));

  // ── algorithm constants: E02 (the game's page code) ──
  const ct = String(e2.constants?.text ?? '');
  const cst = (name: string) => { const m = new RegExp(`(?:^|[ ,])${name.replace('$', '\\$')}=([0-9.e+]+)`).exec(ct); return m ? Number(m[1]) : NaN; };
  const gc = cst('gc'), bc = cst('bc'), eo = cst('eo'), Xs = cst('Xs'), xq = cst('xq'), num = cst('$s');
  same('HOUSE_EDGE (E02 gc)', HOUSE_EDGE, gc);
  same('MIN_TARGET_H (E02 bc × 100)', MIN_TARGET_H, Math.round(bc * 100));
  same('MAX_TARGET_H (E02 eo × 100)', MAX_TARGET_H, Math.round(eo * 100));
  same('DEFAULT_TARGET_H (E02 Xs × 100)', DEFAULT_TARGET_H, Math.round(Xs * 100));
  same('TWO32 (E02 xq)', TWO32, xq);
  same('NUMERATOR (E02 $s)', NUMERATOR, num);
  same('MAX_RESULT_H (E02 eo × 100, the result cap)', MAX_RESULT_H, Math.round(eo * 100));
  same('WIN_RULE_TEXT (E02 rulesWinWhen)', WIN_RULE_TEXT, panel.rulesWinWhen);
  const wcn = (/Win chance = (\d+) ÷ target/.exec(String(panel.rulesChanceFormula ?? '')) || [])[1];
  const winChanceNumerator = wcn === undefined ? null : Number(wcn);
  same('win chance numerator (E02 rulesChanceFormula) × 2^32 / 100', NUMERATOR, winChanceNumerator === null ? 'absent' : winChanceNumerator * TWO32);

  // ── limits: E03 wallet ──
  same('MIN_STAKE (E03 wallet.minBet)', MIN_STAKE, dec(wallet.minBet));
  same('MAX_WIN (E03 wallet.maxWin)', MAX_WIN, dec(wallet.maxWin));
  same('WALLET_DECIMALS (E03 wallet.decimals)', WALLET_DECIMALS, wallet.decimals);

  return { places, claimRtp, claimSource, placesAgree, vectors, minStake: dec(wallet.minBet), maxWin: dec(wallet.maxWin), maxBet: dec(wallet.maxBet),
    numerator: num, houseEdgeFormula: gc, winChanceNumerator, mismatches, compared };
}
