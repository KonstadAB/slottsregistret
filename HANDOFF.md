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

## Rundturer – regel (Daniel 2 okt kväll)
- **Bara rundturer där man kan röra sig mellan platser räknas** (kind `walk`). Enstaka 360-bilder (`look`, även Kungliga slottens
  rumsvisningar) räknas inte och visas inte; de ligger kvar i rundturer.json och filtreras bort i `tools/sammanstall.py`.
  Därmed 23 slott med rundtur (var 36).
- Bjärsjölagård: startbilden vald av Daniel (pano CIHM0ogKEICAgICe6J7i-QE, riktning 252°).

## Rundturer (läge 2 okt)
- 36 slott med rundtur. Källor: Google Maps-bilder från andra än Google nära slottet (Street View-metadata i ett rutnät runt
  slottet, `streetview` i bestallning), granskade för hand via miniatyrer (Street View Static API). Bara bilder som visar slottet
  inifrån (eller inne i ruinen/fästningen) räknas; parkpromenader räknas inte. Kungliga slottens egna 360-visningar
  (vr.kungligaslotten.se) för Drottningholm, Gripsholm, Stockholms slott och Ulriksdal (öppnas i nytt fönster, inte inbäddade).
- VR Media International AB har rundturer på Gränsö slott och Svaneholms slott. Sedan 17 okt visas VR Medias egna versioner (StepInside,
  3DVista) inbäddade i stället för Google Maps, på Daniels begäran. De ligger på
  `https://googlestreetview.s3.eu-central-1.amazonaws.com/<Namn>/VR+Media+International+AB/index.htm` (Namn = Google-företagsnamnet
  utan å/ä/ö, + för mellanslag: `Svaneholm+Castle`, `Granso+Slott`). Alla 250 slott söktes av med namnvarianter 17 okt (konstad-repot,
  grenen claude/vr-media-rundturer): inga fler slott. Läckö är gjord men inte klar än (Daniel 17 okt); lägg in den när han säger till.
- Hemligheten MAPS_KEY gav tom nyckel 17 okt (grenen claude/vr-media-skanning, skanning av Street View runt slott och golfbanor,
  körs när nyckeln finns). Tidigare skanningar fick nyckeln som indata `nyckel`.
- Google-nyckeln (Daniels) skickas som indata `nyckel` till arbetsflödet Hämta data (maskeras), används i `{MAPS_KEY}`.

## Publicering
- `.github/workflows/publicera.yml`: push till `main` bygger och kör `wrangler deploy` (kräver hemligheten CLOUDFLARE_API_TOKEN).
- Workern heter `slottsregistret`, konto 36f39bea33a1d0e03815a8b01039efea.
- Formulären behöver en KV-namnrymd (FORMS) och e-post (Email Routing, MAIL/MAIL_TO) – läggs till i wrangler.jsonc när zonen finns.

## Läge 2 okt kl. 17 (flytt från chatten till Claude Code)
- Sajten ligger på provadressen https://slottsregistret.konstadab.workers.dev (Workern `slottsregistret`). Push till `main` publicerar automatiskt.
- GitHub-hemligheter finns: `CLOUDFLARE_API_TOKEN` (konto 36f39bea…, Workers + Zone Edit + DNS Edit för alla zoner) och `MAPS_KEY` (Google, Street View).
  Hemligheter kan inte läggas in härifrån (proxyn spärrar GitHubs secrets-API); be Daniel om det behövs fler.
- Cloudflare-zonen slottsregistret.se är skapad (id ea79ee838c7bee0ef2100f012784f653, status pending, namnservrar ian.ns.cloudflare.com och
  kimora.ns.cloudflare.com). Inga DNS-poster importerades (hos One.com fanns bara deras parkeringssida och MX "0 .").
- Domänen är registrerad hos One.com. Daniel stängde av DNSSEC där 2 okt kl. 16.16. DS-posten (1094 13 2 9CDD…) fanns kvar hos .se kl. 16.20. DS-posten var BORTA 3 okt 06.30 UTC (NS fortfarande One.com) – nästa steg är namnserverbytet.
  NÄSTA STEG: kontrollera DS (jsonUrls `https://dns.google/resolve?name=slottsregistret.se&type=DS`). När den är borta: guida Daniel att byta
  namnservrar hos One.com (https://www.one.com/admin/dns.do, välj slottsregistret.se, fliken Namnserver) till ian/kimora. När zonen är aktiv:
  lägg till slottsregistret.se och www som egna domäner på Workern (API: PUT /accounts/{account}/workers/domains), slå på DNSSEC i Cloudflare och
  be Daniel lägga in DS-posten hos One.com, skapa KV för formulären, Email Routing (kontakt@ → konstadab@gmail.com; nyckeln saknar Email Routing-behörighet,
  be om utökad nyckel eller ett klick), Search Console.
- Startsidan har en filmisk hero (2 okt): sju Commons-bilder (Läckö, Drottningholm, Gripsholm, Kalmar, Skokloster, Stora Sundby, Tjolöholm),
  `tools/hero.py` → `src/assets/hero/` + `src/hero.json`, `src/assets/hero.js` (övertoning var 7:e s, Ken Burns, laddar efter första bilden).
  Daniel vill ha en exklusiv känsla med guld; silver och brons finns som färger (`--silver*`, `--bronze*`) för t.ex. betalnivåer.
- Daniel tycker att designen i övrigt "hänger efter lite" – en designgenomgång av hela sajten är nästa större uppgift.
- Daniel vill inte ha mejl från misslyckade arbetsflöden: arbetsflödena ska inte misslyckas i onödan (saknad nyckel = hoppa över).

## Designgenomgång 2 okt kväll (grenen claude/project-thread-a4pzrq, inte publicerad)
- Förhandsvisning: skriv sidor i `data/source/granska.txt` och pusha på en claude/-gren → `.github/workflows/granska.yml` laddar upp
  en förhandsversion av Workern på https://granska-slottsregistret.konstadab.workers.dev (rör inte den publicerade sajten) och tar
  skärmbilder (dator + mobil, `tools/granska.mjs`) som sparas på grenen `claude/granska-bilder` (skrivs över varje gång).
- Slottens sidor: stor bild överst (bara om bilden är minst 1000 px bred, annars bild bredvid rubriken), rundturen som en välvd
  "port", "Dörren är ännu stängd"-ruta för slott utan rundtur. Den lilla kartan var tom (skripten laddades i fel ordning) – lagat.
- Kort: bilden bär kortet, ort i guld, "Kliv in"-märke med dörrikon. Två kort i bredd på mobil. Listsidor och län får bild överst.
- Startsidan: bildrutor för erbjudandena (handplockade slott i `TILE` i templates.js), länslistan sorterad på antal slott.
- För slott-sidan omgjord till säljsida (bild, siffror, tre fördelar, formulär).
- Kategorin "Bo" är bullrig (Bohus fästning, Läckö m.fl. räknas) – rättas när spa/boende kontrolleras.

## Natten 2–3 okt (samma gren, inte publicerad)
- Kategorier rensade för hand mot slottens webbplatser (`notOffers` i manuellt.json): Bo 42→35, Spa 7→5, Bohus inte Bröllop.
- Kartan: nedtonade kartplattor (CSS-filter), startvy södra/mellersta Sverige, rubrik i panelen. Kartbilden på startsidan har
  Sveriges och grannländernas konturer (`data/geo/norden.json`, Natural Earth, public domain).
- Sök (mörk rubrikdel), textsidorna (guldlinje), formulären (guldfokus) och 404 ("Här tog vägen slut", med bild och sök).
- Menyn: sökikon; i mobilmenyn även Spa och För slottsägare. Länssidan: bildrutor per län.
- Brödsmulor som strukturerad data (BreadcrumbList) på slott och listsidor.
- Bilder: Wikimedia begränsar nya miniatyrer ibland (429) – Workern försöker tre gånger, webbläsaren en gång till efter 2,5 s.
- `tools/hamta.mjs` sparar nu slutadressen (`url`) för jsonUrls, t.ex. för korta Google Maps-länkar.
- Datakontroll (natten till 3 okt): jämförde läge mot län och Wikidata-kommun, och dubbletter av Wikidata-poster.
  - Engsö slott var samma som Ängsö slott → `skip`. Rosendals slott (Skåne) gick inte att bekräfta (matchades mot
    Rosendal på Djurgården) → `skip` tills vi vet var det ligger.
  - Fjällnäs (låg i Gällivare) och Haga slott i Enköping (var Hagaslottet i Solna) → `qid: null` + rätt läge.
    `qid: null` i manuellt.json betyder nu "ingen Wikidata-post stämmer".
  - ~20 döda webbplatslänkar bytta (hovdala.se, svaneholmsslott.se, tyresoslott.se, julitagard.se, glimmingehus.se m.fl.).
    Kvar utan webbplats: Charlottenlund, Fiholm, Rödbergsfortet. Hjularöd och Sturehov blockerar bara robotar.
  - Bilder från Commons till 10 slott som saknade bild (Grönsöö, Sjöö, Yxtaholm, Wapnö m.fl.); bara 4 saknar nu bild.
  - Kommun rättad för 12 slott där Wikidata och Wikipedia var överens mot grundlistan (Boo, Haddebo, Svenstorp, Dybäck,
    Näsbyholm, Beritsholm, Tureborg, Dagsnäs, Huseby, Mem, Elghammar, Ekholmen). Koberg kvar (källorna oense).
- Sökmotorbeskrivning per slott: läge + "Här kan du bo, ha konferens …" + hela meningar ur texten upp till ~165 tecken.
- Rundturer (3 okt natt): 23 → 28 slott. Nya: Mårbacka (Kuula, 5 punkter ute och inne, inbäddad), Almnäs (Panotour med
  flygbild, länk), Glimmingehus (3D-modeller rum för rum på Sketchfab, länk). Kungliga slottens 360-visningar med flera
  punkter att gå mellan räknas nu som `walk`: Rikssalen, Gustav III:s antikmuseum, Vasa till Bernadotte, Ehrenstrahlsalongen,
  Ulriksdal. Enskilda rum utan förflyttning (Gripsholms rum, Hedvig Eleonoras sängkammare) är kvar som `look`.
  Daniel bör bekräfta att Mårbacka (5 punkter) och Glimmingehus (3D) räknas enligt hans regel.
- Större bilder (≥1280 px, valda för hand efter förhandsbild) för 14 slott som hade små bilder; 15 har fortfarande liten bild.
- Sökningen använder även andra namn från Wikidata/Wikipedia (`alts`, kan sättas för hand i manuellt.json).
- Formulären skickas med fetch (form.js) och visar fel på sidan i stället för en textsida. OBS: utan KV (bindningen
  FORMS) svarar /api/skicka 503 – formulären fungerar alltså inte förrän KV är skapat (se Att göra 2).
- Granska kan nu fotografera andra sidor (hel adress på en rad), trycka på rundturens startknapp (`/slott/x/ start`) och
  provskicka ett formulär (`/tipsa/ skicka`).
- Länssidorna har en ingress byggd av registret (kända slott, hur många man kan bo på / gifta sig på / besöka).
- Bilder: första gången en miniatyr begärs kan Wikimedia svara 429, och Cloudflares cache gäller bara per datacenter.
  Långsiktigt bättre: lägg miniatyrerna i R2 (en gång hämtad = sparad för alla). Kräver att Daniel slår på R2 i
  Cloudflare (betalkort/villkor) – föreslå när domänen är klar.
- Sökningen i hamta.mjs (DuckDuckGo) försöker igen vid 202 och har en tidsgräns på 12 min, så körningen aldrig går över tid.
  Gissa hellre adresser direkt med `textPages` – snabbare och säkrare.

## Att göra
1. Daniel: Cloudflare-nyckel som GitHub-hemlighet → skapa zonen slottsregistret.se, byt namnservrar hos registraren, publicera.
2. KV för formulären, Email Routing (kontakt@ → konstadab@gmail.com), Search Console.
3. Fler rundturer: slottens egna sidor (fler undersidor), Matterport/Kuula/3DVista-sökning, VR Medias egna listor.
4. Spa och boende behöver kontrolleras slott för slott (bara 7 spa hittades automatiskt).
5. Etapp 2: konton för slott, förfrågningar bröllop/konferens, affiliate-länkar.

## SEO-genomgång (22 oktober 2026)
Gjort 22 okt: sitemap har inget `lastmod` längre. Dagens datum på alla adresser vid varje bygge gjorde datumen meningslösa för Google (samma ändring som på svenskakyrkor.se). **Obs:** Publicera-körningen blev grön (26 s), men slottsregistret.se visade fortfarande 17 okt-versionen kl. 12.10 (sitemap med `lastmod` 2026-10-17). Troligen saknas hemligheten CLOUDFLARE_API_TOKEN, så att steget hoppades över (se Att göra 1). Kontrollera hur 17 okt-versionen kom ut och publicera igen.

Att göra. Daniel 22 okt: inget mer byggs före lördag natt 24–25 okt, när han får ny användning. Grunden (egna titlar, canonical, en H1, BreadcrumbList, platsdata, alt-texter) är bra.
1. **Search Console och Bing Webmaster Tools** saknas. De kräver Daniels godkännande en gång, som för svenskakyrkor.se.
2. ~~**Tunna sidor.**~~ Gjort 26 okt (se nedan).
3. ~~**Om, Kontakt, Integritet, Sök och Tack**~~ Gjort 26 okt (se nedan).
4. **Slottsidornas text:** kontrollera hur mycket som är unikt jämfört med Wikipedia. Text som redan finns på nätet rankar sämre än originalet.
5. **Länkar utifrån:** ett märke eller en länk som slotten kan sätta på sin egen sajt, turistorganisationer och VR Media.

### 26 okt: SEO-pass, punkt 2 och 3 (grenen hq/seo-pass-pa-slottsregistret-se-repo-kons-2610261042, inte publicerad)
- **Ingresser** på alla 19 länssidor, 104 kategorisidor per län och de 10 kategorisidorna för hela Sverige (133 sidor). Byggs i
  `src/ingress.js` ur `site-data.json` vid varje bygge (inga handskrivna texter, `sammanstall.py` kördes inte). Innehåll: antal,
  kända namn med kommun, typ och århundrade, vad slotten dessutom erbjuder (med länkar till kategorisidorna), slott med rundtur
  (eller närmaste slott med rundtur), privata/delvis öppna, slott inom fem mil, närmaste slott och län utanför länet. Ordval väljs
  med en slumpgenerator som utgår från sidans adress, så att samma sida alltid får samma text men sidorna skiljer sig åt.
  Ingressen visas under sidhuvudet, före länets mätare och knapparna. Sidornas korta ingress i sidhuvudet och beskrivning är oförändrade.
- Ord i ingressen: 134–238 (127 av 133 sidor ≥ 150). Lägst: Slott att besöka i Örebro län, Kalmar län och Värmland (två–tre slott).
  Innehållstext totalt (utan kortlistan) är minst 169 ord på alla sidorna.
- Sidor med ett enda slott (Jämtland, Norrbotten, Västernorrland och ett fyrtiotal kategori/län-sidor) får ett porträtt av slottet,
  närmaste slott och län utanför samt rundtur i närheten. De håller längden men blir naturligt mer lika varandra; mer unik text där
  kräver uppgifter vi inte har (egna beskrivningar).
- **Egna titlar och beskrivningar** för Om, Kontakt, Integritet, Sök och Tack (127–148 tecken).
- Rättat: `kommunLabel` skrev "Kalmars kommun" – nu "Kalmar kommun" (syns även på slottssidorna).
- `data/source/granska.txt`: Skåne, bröllop i Skåne, bo på slott i Södermanland och Jämtland för förhandsvisning.

Nästa steg: Daniel läser några sidor (t.ex. /lan/skane/, /brollop-och-fest/skane/, /lan/jamtland/) och säger till om tonen; sedan publicera.
Vill man justera formuleringar finns alla varianter samlade i `CAT` och funktionerna i `src/ingress.js`.

## 3 okt förmiddag
- Daniel: Mårbacka räknas som rundtur; Glimmingehus 3D räknas inte (kind '3d', visas inte; kan bli en egen 3D-del). Slottens egna turer före Google Maps.
- Daniel vill att VR Medias egna StepInside-turer (Svaneholm, Läckö m.fl.) ersätter Google-turerna. vrmedia.se är en JS-app som inte går att läsa via hamta; behöver länkarna från Daniel eller skärmbild via granska.
- Allt från natten publicerat 3 okt på Daniels begäran.

## 6 okt: leta fler rundturer (grenen claude/project-thread-y52k5g, publicerad 17 okt)
- Nytt i `tools/hamta.mjs`: `tourScan` – läser startsidan + upp till 40 undersidor på en webbplats och söker hela koden efter
  kända rundtursleverantörer (Matterport, Kuula, 3DVista, krpano, StepInside, Street View-inbäddningar m.fl.).
- Körd på alla 141 slott med webbplats, ett tjugotal kataloger/museer och svenska 360-fotografers sidor. Webbsökningar slott för slott
  gav inget. Slutsats: nästan inga svenska slott har egen rundtur på sin webbplats (bra säljläge för VR Media).
- Nya: Häringe slott (3DVista av OneManWork, inbäddad, nedre/övre våningen/kavaljersflygeln) och Malmöhus (Malmö museers egen tur,
  Kungsvåningen m.fl., går före Google-turen). Kärnan: en Google 360-bild per våning på karnan.se, inte länkade → `look` tills Daniel säger annat.
- Prövat utan resultat: Karlskrona 360 (Drottningskär/Kungsholm bara en flygbild var), Stola "Rundtur" (bildgalleri), Huseby "rundtur" (text),
  Kungliga slottens 360-lista (laddas med JS, inga nya adresser hittade). Borgholm: möjlig 3D-modell på Sketchfab (okontrollerad).
- Daniel 6 okt: Kärnan räknas inte (ligger kvar som `look`). VR Medias turer (credit "VR Media") sorteras först bland slott med rundtur,
  Svaneholm först på startsidan. Läckö: VR Medias egen länk saknas fortfarande. Excel-lista över alla slott med kontaktuppgifter
  (hämtade från webbplatserna) i projektmappen listor-6-okt/.

## 17 okt: publicerat
- Ändringarna från 6 okt (Häringe, Malmöhus, VR Media först, Svaneholm överst) publicerade 17 okt på Daniels begäran, ihop med VR Medias egna
  turer för Svaneholm och Gränsö. `site-data.json` är 6 okt-versionen plus de två turerna. Obs: kör man `tools/sammanstall.py` nu ändras
  kategorierna för åtta slott (Sofiero, Bäckaskog, Ovesholm, Högestad, Skottorp, Solliden, Rockelstad, Tistad), eftersom svar.json fick nya
  webbplatstexter vid kontakthämtningen 6 okt. Granska dem innan nästa omkörning publiceras.
