#!/usr/bin/env python3
"""Sammanställer registret till data/site-data.json, som build.js bygger sajten av.

Källor, i den ordning de gäller (senare skriver över tidigare):
  data/slott.json              grundlistan (namn, typ, kommun, län, användning, öppet, prioritet)
  data/source/svar.json        hämtade öppna data (Wikidata, Wikipedia, Commons, webbplatser, Street View, geokodning)
  data/source/matchning.json   vilken Wikidata-post varje slott är (tools/matcha.py)
  data/manuellt.json           rättelser för hand per slott: qid, lat/lon, kommun, webbplats, erbjudanden, bild, text m.m.
  data/rundturer.json          virtuella rundturer per slott (granskade)
Kör: python3 tools/sammanstall.py
"""
import json, hashlib, re, unicodedata, datetime

def load(p, default):
    try:
        return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError:
        return default

S = load('data/slott.json', [])
V = load('data/source/svar.json', {})
MATCH = load('data/source/matchning.json', {})
MAN = load('data/manuellt.json', {})
TOURS = load('data/rundturer.json', {})
E, WIKI, COM, GEO, PAGES = V.get('entities', {}), V.get('wiki', {}), V.get('commons', {}), V.get('geocode', {}), V.get('pages', {})

def slug(s):
    s = unicodedata.normalize('NFKD', s.lower().replace('å', 'a').replace('ä', 'a').replace('ö', 'o'))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def commons_path(name):
    n = name.replace(' ', '_')
    h = hashlib.md5(n.encode('utf-8')).hexdigest()
    return f'{h[0]}/{h[:2]}/{n}'

# Län: officiella namn och ordning (från söder).
LAN = ['Skåne', 'Blekinge', 'Halland', 'Kronoberg', 'Kalmar', 'Jönköping', 'Gotland', 'Västra Götaland', 'Östergötland',
       'Södermanland', 'Stockholm', 'Uppsala', 'Västmanland', 'Örebro', 'Värmland', 'Dalarna', 'Gävleborg', 'Västernorrland',
       'Jämtland', 'Västerbotten', 'Norrbotten']
LAN_FULL = {l: (l + ' län' if l not in ('Skåne', 'Västra Götaland', 'Gotland') else
               {'Skåne': 'Skåne län', 'Västra Götaland': 'Västra Götalands län', 'Gotland': 'Gotlands län'}[l]) for l in LAN}
LAN_FULL.update({'Stockholm': 'Stockholms län', 'Kalmar': 'Kalmar län', 'Jönköping': 'Jönköpings län', 'Uppsala': 'Uppsala län',
                 'Örebro': 'Örebro län', 'Halland': 'Hallands län', 'Blekinge': 'Blekinge län', 'Kronoberg': 'Kronobergs län',
                 'Östergötland': 'Östergötlands län', 'Södermanland': 'Södermanlands län', 'Västmanland': 'Västmanlands län',
                 'Värmland': 'Värmlands län', 'Dalarna': 'Dalarnas län', 'Gävleborg': 'Gävleborgs län',
                 'Västernorrland': 'Västernorrlands län', 'Jämtland': 'Jämtlands län', 'Västerbotten': 'Västerbottens län',
                 'Norrbotten': 'Norrbottens län'})

# Kategorier. "kind" avgör var de visas: erbjudanden (vad man kan göra) och typer (vad det är).
CATS = [
    # slug, namn, kort namn, kind, ingress
    ('bo-pa-slott', 'Bo på slott', 'Bo', 'offer', 'Slott och slottsmiljöer där du kan övernatta – slottshotell, värdshus och gästrum.'),
    ('spa', 'Spa på slott', 'Spa', 'offer', 'Slott och slottshotell med spa, bad eller behandlingar.'),
    ('konferens', 'Konferens på slott', 'Konferens', 'offer', 'Slott för möten, konferenser och kickoffer.'),
    ('brollop-och-fest', 'Bröllop och fest på slott', 'Bröllop & fest', 'offer', 'Slott för bröllop, vigsel och fest.'),
    ('restaurang-och-kafe', 'Restaurang och kafé på slott', 'Mat', 'offer', 'Slott med restaurang, kafé eller servering.'),
    ('besok', 'Slott att besöka', 'Besöka', 'offer', 'Slott, borgar och fästningar som är öppna för besökare – museer, visningar och utställningar.'),
    ('park-och-tradgard', 'Slottsparker och trädgårdar', 'Park', 'offer', 'Slott med park eller trädgård som går att besöka.'),
    ('kungliga-slott', 'Kungliga slott', 'Kungliga', 'type', 'De kungliga slotten och lustslotten.'),
    ('borgar-och-ruiner', 'Borgar och slottsruiner', 'Borgar & ruiner', 'type', 'Medeltida borgar, fornborgar och slottsruiner.'),
    ('fastningar', 'Fästningar', 'Fästningar', 'type', 'Fästningar, kastell och skansar.'),
]

def offers_for(c, site_text):
    use = (c['use'] or '').lower()
    t = (c['type'] or '').lower()
    st = (site_text or '').lower()
    o = set()
    if re.search(r'hotell|övernatt|vandrarhem', use): o.add('bo-pa-slott')
    if re.search(r'konferens', use): o.add('konferens')
    if re.search(r'bröllop', use) or ('evenemang' in use and re.search(r'\bbröllop', st)): o.add('brollop-och-fest')
    if re.search(r'restaurang|kafé|café|servering', use): o.add('restaurang-och-kafe')
    if c['open'] == 'Ja' or re.search(r'museum|visning', use): o.add('besok')
    if re.search(r'park|trädgård|skulpturpark', use): o.add('park-och-tradgard')
    if 'kungligt' in t or 'kungligt' in use: o.add('kungliga-slott')
    if re.search(r'ruin|fornborg|borg\b|borgtorn', t): o.add('borgar-och-ruiner')
    if re.search(r'fästning|fort|kastell|skans', t + ' ' + c['name'].lower()): o.add('fastningar')
    return o

def wiki_intro(title):
    w = WIKI.get(title) if title else None
    if not w:
        return None
    return {'title': w['title'], 'text': w['text']}

out, problems = [], []
for c in S:
    m = MAN.get(c['id'], {})
    if m.get('skip'):
        continue
    qid = m.get('qid') or MATCH.get(c['id'])
    e = E.get(qid, {}) if qid else {}
    lat, lon = m.get('lat', e.get('lat')), m.get('lon', e.get('lon'))
    if lat is None and GEO.get(c['id']):
        lat, lon = GEO[c['id']]['lat'], GEO[c['id']]['lon']
    website = m.get('website', e.get('website'))
    page = PAGES.get(website, {}) if website else {}
    img = m.get('image', e.get('image'))
    image = None
    if img and re.search(r'\.(jpe?g|png|webp)$', img, re.I):
        info = COM.get(img, {})
        image = {'file': img, 'path': commons_path(img), 'w': info.get('w'), 'h': info.get('h'),
                 'artist': info.get('artist') or None, 'license': info.get('license') or None, 'page': info.get('page')}
    rec = {
        'id': c['id'], 'slug': c['id'], 'name': c['name'], 'type': c['type'], 'kommun': m.get('kommun', c['kommun']),
        'lan': c['lan'], 'lanSlug': slug(c['lan']), 'use': c['use'], 'open': c['open'], 'prio': c['prio'],
        'qid': qid, 'lat': lat, 'lon': lon, 'inception': e.get('inception'), 'website': website,
        'image': image, 'wiki': wiki_intro(m.get('article', e.get('article'))),
        'text': m.get('text'),
        'offers': sorted(set(m.get('offers', [])) | (offers_for(c, page.get('text')) - set(m.get('notOffers', [])))),
        'tours': TOURS.get(c['id'], []),
    }
    if lat is None:
        problems.append(f"saknar läge: {c['name']}")
    out.append(rec)

counties = []
for l in LAN:
    items = [x for x in out if x['lan'] == l]
    if not items:
        continue
    counties.append({'name': l, 'full': LAN_FULL.get(l, l + ' län'), 'slug': slug(l), 'total': len(items),
                     'withTour': sum(1 for x in items if x['tours'])})
cats = []
for s, n, short, kind, intro in CATS:
    cats.append({'slug': s, 'name': n, 'short': short, 'kind': kind, 'intro': intro,
                 'total': sum(1 for x in out if s in x['offers'])})
data = {
    'built': datetime.date.today().isoformat(),
    'castles': out, 'counties': counties, 'categories': cats,
    'stats': {'total': len(out), 'withTour': sum(1 for x in out if x['tours']),
              'located': sum(1 for x in out if x['lat'] is not None)},
}
json.dump(data, open('data/site-data.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('Slott', len(out), '| med läge', data['stats']['located'], '| med bild', sum(1 for x in out if x['image']),
      '| med text', sum(1 for x in out if x['wiki'] or x['text']), '| med rundtur', data['stats']['withTour'])
print('Kategorier:', ', '.join(f"{c['short']} {c['total']}" for c in cats))
for p in problems:
    print(' -', p)
