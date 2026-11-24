#!/usr/bin/env python3
"""Builds evidence/ for the HouseBets limbo package from the HouseBets workshop (run once by the auditor; the outputs are
pinned in src/loader.ts and listed in MANIFEST.md#evidence). Sources (outside this package):
  W = the HouseBets workshop folder (capture rigs, bundles, 12 Oct capture, 13 Oct full capture + ledger)
Every exhibit records its source path and the sha256 of the source bytes it was cut from."""
import hashlib, json, os, re, shutil, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); PKG = os.path.dirname(HERE)
W = os.path.abspath(os.path.join(PKG, '..', '..', 'housebets-new-deal-2026-10-09'))
EV = os.path.join(PKG, 'evidence'); os.makedirs(EV, exist_ok=True)
sha = lambda b: hashlib.sha256(b).hexdigest()
def dump(name, obj):
    open(os.path.join(EV, name), 'w', encoding='utf-8').write(json.dumps(obj, indent=2, ensure_ascii=False) + '\n'); print('wrote', name)

prim_path = os.path.join(PKG, 'data', 'captured', 'housebets-limbo-sp1-6480bets.redacted.json')
prim_raw = open(prim_path, 'rb').read(); prim = json.loads(prim_raw)
pf = prim['meta']['preflight']
src_note = {'file': 'data/captured/housebets-limbo-sp1-6480bets.redacted.json', 'sha256': sha(prim_raw), 'field': None}

# E01 the server's published limbo spec, as answered to the capture (GET /housegames/limbo/fairness, 12 Oct 17:04:46Z)
dump('E01-limbo-fairness-spec-2026-10-12.json', {'exhibit': 'E01', 'what': "HouseBets House Games limbo: the server's published fairness spec (GET /housegames/limbo/fairness)",
     'source': dict(src_note, field='meta.preflight.fairness'), 'answer': pf['fairness']})
# E03 the limits answer (min bet, max bet, max win, wallet decimals)
dump('E03-limbo-limits-2026-10-12.json', {'exhibit': 'E03', 'what': 'HouseBets limbo limits (GET /housegames/limits/limbo)',
     'source': dict(src_note, field='meta.preflight.limits'), 'answer': pf['limits']})

# E02 the game page's rules panel and the constants/functions it is filled from, as shipped in the live limbo bundle
bp = os.path.join(W, 'bundles', 'platform-housegames-limbo-game.js'); braw = open(bp, 'rb').read(); bt = braw.decode('utf-8', 'replace')
i = bt.find('rulesPickTarget:"Pick a target multiplier'); blk = bt[max(0, i - 200): i + 3500]
strings = {}
for key in re.findall(r'(rules[A-Za-z]+):"', blk):
    m = re.search(key + r':"((?:[^"\\]|\\.)*)"', blk)
    if m and key not in strings: strings[key] = m.group(1)
consts = re.search(r'const gc=\.01,bc=1\.01,eo=1e6,Xs=2,xq=4294967296,\$s=425201762304,dm=99/eo,hm=99/bc', bt)
funcs = {}
for name in ('kc', 'Am', 'wc', 'gm', 'Sc', 'fa'):
    m = re.search(r'function ' + name + r'\([^)]*\)\{.*?\}(?=function |const |var |let |$)', bt)
    if m: funcs[name] = m.group(0)
assert consts and strings.get('rulesWinWhen') and funcs.get('kc') and funcs.get('Am'), 'bundle text moved'
dump('E02-limbo-rules-panel-2026-10-10.json', {'exhibit': 'E02', 'what': 'HouseBets limbo game page: the rules panel text (English) and the constants and functions it is filled from, as shipped in the bundle the live page loads',
     'source': {'file': 'bundles/platform-housegames-limbo-game.js (HouseBets workshop)', 'sha256': sha(braw), 'bytes': len(braw), 'checkedOnLivePage': '2026-10-10 (bundles/LIVE-BUNDLES.md)'},
     'rulesPanelEnglish': strings,
     'constants': {'text': consts.group(0), 'meaning': {'HOUSE_EDGE (gc)': 0.01, 'MIN_TARGET (bc)': 1.01, 'MAX_TARGET = RESULT_CAP (eo)': 1000000, 'DEFAULT_TARGET (Xs)': 2,
                   'TWO32 (xq)': 4294967296, 'NUMERATOR ($s = 99 x 2^32)': 425201762304}},
     'functions': {'resultFromUint32V2 (kc)': funcs.get('kc'), 'isWin (Am)': funcs.get('Am'), 'winningDrawsV2 (wc)': funcs.get('wc'),
                   'pWin (gm)': funcs.get('gm'), 'payout (Sc)': funcs.get('Sc'), 'clampTarget (fa)': funcs.get('fa')}})

# E04 the platform bet history rows of every round in this package's datasets
lp = os.path.join(W, 'capture-full-2026-10-12', 'ledger', 'ledger-2026-10-13-final.json'); lraw = open(lp, 'rb').read(); L = json.loads(lraw)
led = {x['id']: x for x in L['items']}
files = ['housebets-limbo-phaseA-6450bets.json', 'housebets-limbo-phaseA-tail-30bets.json', 'supplementary/housebets-limbo-phaseC-250bets.json',
         'supplementary/housebets-limbo-phaseD-200bets.json', 'supplementary/housebets-limbo-phaseC-safe-10usd-200bets.json']
rows, missing = [], []
for f in files:
    for b in json.load(open(os.path.join(PKG, 'data', f)))['bets']:
        x = led.get(b['roundId'])
        if x is None: missing.append(b['roundId']); continue
        rows.append({k: x[k] for k in ('id', 'game', 'placed_at', 'stake', 'payout', 'currency', 'status')})
assert not missing, f'{len(missing)} rounds not in the ledger'
dump('E04-limbo-bet-history-2026-10-13.json', {'exhibit': 'E04', 'what': 'HouseBets bet history (GET /api/v1/transactions/bets?category=casino) rows of every limbo round in this package; fields id = roundId, stake, payout, status',
     'source': {'file': 'capture-full-2026-10-12/ledger/ledger-2026-10-13-final.json (HouseBets workshop)', 'sha256': sha(lraw), 'readAt': L['readAt'], 'entries': len(L['items'])},
     'rows': sorted(rows, key=lambda r: r['placed_at'])})

# E05 the whole-account reconciliation: the FULL output of the workshop's reconcile-full.py (every captured round of all 11
# games against the platform history and the wallet), run on the final ledger with the balance read before the capture
cdir = os.path.join(W, 'capture-full-2026-10-12'); script = os.path.join(cdir, 'reconcile-full.py')
cmd = ['python3', '-I', 'reconcile-full.py', '--ledger', 'ledger/ledger-2026-10-13-final.json', '--before', '986.84718000']
r = subprocess.run(cmd, cwd=cdir, capture_output=True, text=True)
assert r.returncode == 0 and r.stdout.rstrip().endswith('RECONCILED'), 'reconcile-full.py did not reconcile'
head = (f"# E05 {' '.join(cmd)}  (cwd capture-full-2026-10-12/, HouseBets workshop) exit {r.returncode}\n"
        f"# reconcile-full.py sha256 {sha(open(script, 'rb').read())} · ledger-2026-10-13-final.json sha256 {sha(open(os.path.join(cdir, 'ledger', 'ledger-2026-10-13-final.json'), 'rb').read())}\n")
open(os.path.join(EV, 'E05-account-reconcile-2026-10-13.txt'), 'w', encoding='utf-8').write(head + r.stdout); print('wrote E05')

# E06 the empty-client-seed control of Phase D (POST /change_seed with clientSeed "")
dp = os.path.join(PKG, 'data', 'supplementary', 'housebets-limbo-phaseD-200bets.json'); draw = open(dp, 'rb').read()
dump('E06-limbo-empty-seed-control-2026-10-13.json', {'exhibit': 'E06', 'what': 'Phase D empty-seed control: the server\'s answer to POST /change_seed {clientSeed: ""}',
     'source': {'file': 'data/supplementary/housebets-limbo-phaseD-200bets.json', 'sha256': sha(draw), 'field': 'meta.emptySeedControl'}, 'record': json.loads(draw)['meta']['emptySeedControl']})
