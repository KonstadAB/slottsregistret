#!/usr/bin/env python3
"""Skapar bilderna till startsidans film (src/assets/hero/) och src/hero.json.

Källbilder: data/source/hero/full-<slott-id>.jpg (1920 px från Wikimedia Commons, hämtade med tools/hamta.mjs).
Ordningen nedan är filmens ordning. Fotograf och licens tas från data/site-data.json.
Kör: python3 tools/hero.py
"""
import json, os
from PIL import Image

ORDER = ['lacko-slott', 'drottningholms-slott', 'gripsholms-slott', 'kalmar-slott', 'skoklosters-slott', 'stora-sundby-slott', 'tjoloholms-slott']
OUT = 'src/assets/hero'
os.makedirs(OUT, exist_ok=True)
D = {c['id']: c for c in json.load(open('data/site-data.json'))['castles']}
meta = []
for cid in ORDER:
    src = f'data/source/hero/full-{cid}.jpg'
    if not os.path.exists(src):
        print('saknas', src); continue
    im = Image.open(src).convert('RGB')
    for w, fmt, q in [(1920, 'avif', 52), (1100, 'avif', 50), (1600, 'jpg', 78)]:
        x = im.copy()
        if x.width > w:
            x = x.resize((w, round(x.height * w / x.width)), Image.LANCZOS)
        p = f'{OUT}/{cid}-{w}.{fmt}'
        if fmt == 'avif': x.save(p, 'AVIF', quality=q, speed=4)
        else: x.save(p, 'JPEG', quality=q, optimize=True, progressive=True)
    c = D[cid]; img = c['image']
    credit = 'Foto: ' + (img.get('artist') or 'okänd') + (f", {img['license']}" if img.get('license') else '') + ', Wikimedia Commons'
    meta.append({'id': cid, 'name': c['name'], 'credit': credit})
    print(cid, *[f"{os.path.getsize(f'{OUT}/{cid}-{w}.{f}')//1024}k" for w, f in [(1920, 'avif'), (1100, 'avif'), (1600, 'jpg')]])
json.dump(meta, open('src/hero.json', 'w'), ensure_ascii=False, indent=1)
