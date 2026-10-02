# Kopplar varje slott i data/slott.json till en Wikidata-post bland sökträffarna i data/source/svar.json.
# Resultatet skrivs till data/source/matchning.json och kan rättas för hand i data/manuellt.json (qid).
import json,re,unicodedata,math
S=json.load(open('data/slott.json')); V=json.load(open('data/source/svar.json'))
E=V['entities']; L=V.get('labels',{})
try: M=json.load(open('data/manuellt.json'))
except FileNotFoundError: M={}
castle_t={r['t'].split('/')[-1] for r in V['sparql']['slott']}
castle_ids={r['i'].split('/')[-1] for r in V['sparql']['slott']}
def norm(s): 
    s=unicodedata.normalize('NFKD',s.lower()); s=''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9 ]',' ',s)
STOP={'slott','slottet','borg','borgen','slottsruin','borgruin','ruin','fastning','fastningen','herrgard','gard','kungsgard','fort','kastell','hus','av','i','pa','s'}
def toks(s): return {t for t in norm(s).split() if t not in STOP and len(t)>1}
def insweden(e): return e['lat'] and 55<e['lat']<69.5 and 10.5<e['lon']<24.5
res={}; issues=[]
for c in S:
    if c['id'] in M and M[c['id']].get('qid')!=None:
        res[c['id']]=M[c['id']]['qid']; continue
    best=None
    for h in V['wdsearch'].get(c['id'],[]):
        e=E.get(h['qid']); 
        if not e: continue
        sc=0
        a=toks(c['name']); b=toks(e['label'])|{t for al in e['alts'] for t in toks(al)}
        if a and a<=b: sc+=4
        elif a&b: sc+=2
        if h['qid'] in castle_ids: sc+=4
        if set(e['types'])&castle_t: sc+=2
        if insweden(e): sc+=2
        else: sc-=5
        adm=' '.join(norm(L.get(x,'')) for x in e['admin'])
        if norm(c['kommun']).strip() in adm: sc+=3
        if e['article']: sc+=1
        if re.search(r'kyrka|socken|tätort|släkt|skepp|bok|film|station|gata|by i|ort i', e['description'] or ''): sc-=4
        if best is None or sc>best[0]: best=(sc,h['qid'])
    if best and best[0]>=7: res[c['id']]=best[1]
    else:
        res[c['id']]=None
        issues.append((c['id'],c['name'],c['kommun'],best))
json.dump(res,open('data/source/matchning.json','w'),indent=1)
print('osäkra',len(issues))
for i in issues:
    q=i[3][1] if i[3] else None; e=E.get(q,{}) if q else {}
    print(i[0],'|',i[2],'|',i[3],'|',e.get('label'),'|',e.get('description'),'|',[L.get(x) for x in e.get('admin',[])])
