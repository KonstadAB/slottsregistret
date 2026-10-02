# Överlämning – slottsregistret.se

## Om projektet
- Ägare: Daniel Andersson, Konstad i Malmö AB (GitHub: KonstadAB). Systersajt till svenskakyrkor.se (samma grund och arbetssätt).
- Syfte utåt: register över Sveriges slott, borgar, fästningar och slottsmiljöer – vad man kan göra där (bo, spa, konferens, bröllop,
  mat, besöka, park) och "vägen in" via virtuella rundturer.
- **Huvudsyfte (står inte på sajten):** att sälja virtuella rundturer (360). Slott med rundtur lyfts fram överallt (först i listor,
  guld på kartan, startsidan), slott utan rundtur får en lugn ruta som får ägaren att vilja ha en. Daniel samarbetar med VR Media International AB.
- Framtid (beslutat 2 okt, inte byggt): inloggning för slotten (sköta sin sida), betalnivåer för synlighet, provision/förfrågningar
  för bröllop och konferens, affiliate till Booking/Expedia. Se Daniels utredning "Slottsregistret – intäktsmodeller" (Claude Docs).
- Plattform: Cloudflare (Worker med statiska filer, som svenskakyrkor.se; Daniel har Workers Paid). Senare D1/KV för konton och
  formulär, Stripe för betalningar. Inga gratistjänster med tak vi snart slår i.

## Struktur
- `data/slott.json` – grundlistan (252 slott: namn, typ, kommun, län, användning, öppet, prioritet 1–3). Källa: Claudes lista 30 sept.
- `data/manuellt.json` – rättelser per slott (qid, lat/lon, kommun, webbplats, offers/notOffers, image, article, text, skip).
- `data/rundturer.json` – granskade rundturer per slott (kind walk/look/view, provider, credit, year, embed eller null, url, title).
- `data/source/` – hämtade data (`svar.json`), matchning mot Wikidata (`matchning.json`), Street View-urval och miniatyrer.
- `tools/matcha.py` → `tools/sammanstall.py` → `data/site-data.json` → `node build.js` → `dist/`.
- `src/templates.js`, `src/assets/*` (CSS, app/sök/karta/slott/formulär-JS, SVG), `src/fonts` (Fraunces + Instrument Sans, OFL).
- `worker/index.js` (www-omdirigering, /img/ Commons-proxy, /tiles/ OSM-proxy, /api/skicka), `worker/forms.js` (formulären slott och tips).
- Kategorier (erbjudanden) räknas fram i `sammanstall.py` ur "användning" och slottets egen webbplats (nyckelord), kan rättas i manuellt.json.

## Rundturer (läge 2 okt)
- 36 slott med rundtur. Källor: Google Maps-bilder från andra än Google nära slottet (Street View-metadata i ett rutnät runt
  slottet, `streetview` i bestallning), granskade för hand via miniatyrer (Street View Static API). Bara bilder som visar slottet
  inifrån (eller inne i ruinen/fästningen) räknas; parkpromenader räknas inte. Kungliga slottens egna 360-visningar
  (vr.kungligaslotten.se) för Drottningholm, Gripsholm, Stockholms slott och Ulriksdal (öppnas i nytt fönster, inte inbäddade).
- VR Media International AB har rundturer på Gränsö slott och Svaneholms slott (Google Maps).
- Google-nyckeln (Daniels) skickas som indata `nyckel` till arbetsflödet Hämta data (maskeras), används i `{MAPS_KEY}`.

## Publicering
- `.github/workflows/publicera.yml`: push till `main` bygger och kör `wrangler deploy` (kräver hemligheten CLOUDFLARE_API_TOKEN).
- Workern heter `slottsregistret`, konto 36f39bea33a1d0e03815a8b01039efea.
- Formulären behöver en KV-namnrymd (FORMS) och e-post (Email Routing, MAIL/MAIL_TO) – läggs till i wrangler.jsonc när zonen finns.

## Att göra
1. Daniel: Cloudflare-nyckel som GitHub-hemlighet → skapa zonen slottsregistret.se, byt namnservrar hos registraren, publicera.
2. KV för formulären, Email Routing (kontakt@ → konstadab@gmail.com), Search Console.
3. Fler rundturer: slottens egna sidor (fler undersidor), Matterport/Kuula/3DVista-sökning, VR Medias egna listor.
4. Spa och boende behöver kontrolleras slott för slott (bara 7 spa hittades automatiskt).
5. Etapp 2: konton för slott, förfrågningar bröllop/konferens, affiliate-länkar.
