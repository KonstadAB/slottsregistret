// Guiderna under /guider/. Texterna är våra egna; uppgifterna om varje slott kommer från slottens egna webbplatser
// (data/erbjudanden.json). L('slug') blir en länk till slottets sida, och bygget stoppar om ett slott saknas.
'use strict';

module.exports = (S, L, list) => [
  {
    slug: 'gifta-sig-pa-slott',
    cat: 'brollop-och-fest',
    title: 'Gifta sig på slott – så hittar ni rätt slott för bröllopet',
    h1: 'Gifta sig på slott',
    description: 'Guide till slottsbröllop i Sverige: olika sorters slott, hur många gäster de tar, boende, vad ni ska fråga slottet och var ni hittar dem.',
    lead: 'Ett slottsbröllop kan vara allt från en enkel vigsel i en slottspark till en hel helg med middag, fest och övernattning för alla gäster. Här är vad som skiljer slotten åt, och vad ni bör ta reda på innan ni bokar.',
    body: () => `
<h2>Tre sorters slottsbröllop</h2>
<p>Slotten som tar emot bröllop i Sverige är väldigt olika. Det hjälper att veta vilken sort ni letar efter innan ni börjar jämföra.</p>
<h3>Slottshotellet: allt på ett ställe</h3>
<p>Många slott drivs i dag som hotell, med restaurang, festvåning och rum för gästerna. Där kan vigsel, middag, fest och frukost dagen efter ske på samma plats, och ofta finns färdiga bröllopspaket. Exempel är ${L('backaskog-slott')} mellan två sjöar i Skåne, ${L('bjertorps-slott')} på Varaslätten, ${L('sundbyholms-slott')} vid Mälaren och ${L('granso-slott')} utanför Västervik.</p>
<h3>Festlokalen: ni hyr rummen och väljer själva</h3>
<p>Andra slott hyr ut en festvåning, ett stall eller en lada, och ni ordnar mat och dryck med slottets cateringpartner eller med en egen. Det ger mer frihet och passar den som vill sätta sin egen prägel. Exempel är ${L('ellinge-slott')}, där korsvirkesstallet hyrs ut, ${L('rockelstads-slott')} vid Båven med egen cateringfirma och ${L('yxtaholms-slott')}, som har öppnat igen som exklusiv plats för bröllop och privata fester.</p>
<h3>Den historiska miljön: vigsel och middag i ett museum eller en fästning</h3>
<p>Kungliga slott, fästningar och slottsmuseer hyr ofta ut salar eller platser för vigsel. Det blir en miljö som få andra bröllop har, men med fler regler och ibland utan boende. Exempel är ${L('kalmar-slott')}, ${L('vadstena-slott')}, ${L('bohus-fastning')} i Kungälv och ${L('kastellet-karlshamn')}, där kyrkan på ön är ett populärt bröllopsställe. På ${L('tyreso-slott')} kan man boka en enkel vigsel i parken.</p>

<h2>Hur många gäster får plats?</h2>
<p>Det första ni bör ta reda på är hur många som får plats vid en sittande middag. Det skiljer enormt mellan slotten. Vissa tar emot ett fyrtiotal gäster, andra flera hundra. Slottens egna sajter anger ofta antal per sal, till exempel:</p>
<ul>
<li>${L('safstaholms-slott')} tar emot bröllop med upp till 75 gäster.</li>
<li>${L('friiberghs-herrgard')} tar bröllop med upp till 100 gäster.</li>
<li>${L('naas-slott')} har festlokalen Lekhuset för 120–200 gäster.</li>
<li>${L('tjoloholms-slott')} har Magasinet, med plats för upp till 550 sittande gäster.</li>
</ul>
<p>Slott som enligt sina egna webbplatser tar emot 150 gäster eller fler vid fest:</p>
<ul>${list('brollop-och-fest').filter(c => c.capacity && c.capacity.fest >= 150).sort((a, b) => a.lan.localeCompare(b.lan, 'sv') || a.name.localeCompare(b.name, 'sv')).map(c => `<li>${L(c.slug)} (${c.kommun}, ${c.lan}): ${c.capacity.festText}</li>`).join('')}</ul>
<p>Tänk också på att en sal som rymmer många vid långbord kan bli trång med dansgolv och bar. Fråga hur rummet ser ut med just ert antal gäster.</p>

<h2>Boende för brudparet och gästerna</h2>
<p>Ligger slottet en bit från stan blir boendet viktigt. Gäster som kan sova kvar slipper planera hemresan och stannar gärna längre på festen. På slottshotellen bor ofta hela sällskapet på plats, som på ${L('mauritzbergs-slott')}, ${L('hasselby-slott')} i Stockholm eller ${L('teleborgs-slott')} vid Växjö. Andra slott har rum i flyglar, villor eller stugor i parken, som ${L('jordberga-slott')} med hotellet Parkvillan och ${L('naas-slott')} med rum i de gamla husen. På vår lista <a href="/bo-pa-slott/">Bo på slott</a> ser ni alla slott där man kan övernatta.</p>

<h2>Frågor att ställa till slottet</h2>
<ul>
<li>Vilka datum är lediga, och finns det lägre priser på fredagar eller utanför sommaren?</li>
<li>Hur många får plats vid sittande middag, och hur många med dansgolv?</li>
<li>Kan vigseln ske på slottet, i parken eller i en kyrka i närheten? Vad händer om det regnar?</li>
<li>Ingår mat och dryck, eller får vi ta in egen catering? Finns det en avgift för det?</li>
<li>Har vi slottet för oss själva, eller finns andra gäster och sällskap samtidigt?</li>
<li>Hur länge får festen hålla på, och finns det regler för musik och ljud?</li>
<li>Hur många rum finns, och kan gästerna boka själva?</li>
<li>Vad ingår i priset: dukning, personal, städning, teknik?</li>
</ul>

<h2>Se slottet innan ni åker dit</h2>
<p>Många av slotten i registret har en virtuell rundtur. Där kan ni gå runt i salarna hemifrån och jämföra flera slott innan ni bokar visningar. Alla finns samlade under <a href="/virtuella-rundturer/">Rundturer</a>.</p>

<h2>Slott för bröllop i hela Sverige</h2>
<p>Vi har samlat ${list('brollop-och-fest').length} slott som tar emot bröllop och fester, kontrollerade mot slottens egna webbplatser. Välj län för att se dem i ert område.</p>`,
  },
  {
    slug: 'bo-pa-slott',
    cat: 'bo-pa-slott',
    title: 'Bo på slott i Sverige – slottshotell, flyglar och vandrarhem',
    h1: 'Bo på slott',
    description: 'Guide till att bo på slott i Sverige: slottshotell, rum i flyglar och villor, slottsvandrarhem och vad som finns att göra runt slotten.',
    lead: 'Att sova på ett slott behöver inte vara dyrt eller krångligt. I Sverige finns allt från lyxiga slottshotell med spa till enkla vandrarhem i slottsparker. Här är de olika sätten att bo, och var ni hittar dem.',
    body: () => `
<h2>Slottshotell</h2>
<p>Det vanligaste sättet att bo på slott är på ett slottshotell. Där finns reception, restaurang och ofta frukost i någon av salongerna. Några bjuder på mer än en säng: ${L('hackeberga-slott')} ligger på en ö i Häckebergasjön och har en gastronomisk restaurang. ${L('bjertorps-slott')} har en restaurang i White Guide, och på ${L('mauritzbergs-slott')} bor man mitt på en golfbana. Nära Stockholm finns bland annat ${L('akeshovs-slott')} i Bromma, ${L('rosersbergs-slott')} tio minuter från Arlanda och ${L('gorvalns-slott')} vid Mälaren.</p>

<h2>Rum i flyglar, villor och stugor</h2>
<p>På många gods bor ägarna kvar i själva slottet, medan gästerna bor i flyglar, villor eller stugor i parken. Det kan bli lugnare och mer personligt än på ett stort hotell. På ${L('tjoloholms-slott')} finns hotellstugor vid Kungsbackafjorden. ${L('vastana-slott')} ovanför Vättern har rum i slottet, flygeln och porthuset, och på ${L('rockelstads-slott')} hyr man självhushållshus i slottsparken.</p>

<h2>Slottsvandrarhem: billigare än man tror</h2>
<p>Vill man bo i slottsmiljö utan att betala för ett slottshotell finns vandrarhem och hostels i flera slottsparker. ${L('bogesunds-slott')} vid Vaxholm har ett slottsvandrarhem 200 meter från slottet. ${L('nynas-slott')} har vandrarhemmet Bränneriet med bastu vid sjön, och på ${L('tyreso-slott')} finns vandrarhemmet Prinsvillan. ${L('sparreholms-slott')} vid Båven har också vandrarhem, nära en av Europas finaste bilsamlingar.</p>

<h2>Kombinera vistelsen med något mer</h2>
<p>Många slott ligger i natursköna lägen, och det finns ofta mer att göra än att äta och sova:</p>
<ul>
<li><strong>Spa:</strong> se vår guide <a href="/guider/slott-med-spa/">Slott med spa</a>.</li>
<li><strong>Golf:</strong> ${L('mauritzbergs-slott')}, ${L('johannesbergs-slott')} och ${L('hooks-herrgard')} har egna golfbanor.</li>
<li><strong>Natur och friluftsliv:</strong> ${L('baldersnas-herrgard')} ligger i ett naturreservat i Dalsland, och ${L('fjallnas')} är Sveriges äldsta fjällhotell.</li>
<li><strong>Konst:</strong> ${L('wanas-slott')} har Sveriges största skulpturpark, och på ${L('skytteholm')} står en av de största samlingarna av Carl Milles skulpturer.</li>
<li><strong>Barnfamiljer:</strong> ${L('fredensborgs-herrgard')} ligger strax söder om Vimmerby, nära Astrid Lindgrens Värld, och på ${L('oster-malma')} finns en djurpark med nordiska djur.</li>
</ul>

<h2>Bra att veta innan ni bokar</h2>
<ul>
<li>Fråga var rummet ligger: i själva slottet, i en flygel eller i en nyare byggnad. Det påverkar både känslan och priset.</li>
<li>Många slott har konferenser på vardagar och bröllop på lördagar under sommaren. Fråga om det är något evenemang när ni ska bo där.</li>
<li>Restaurangen kan ha begränsade öppettider utanför säsong, och ibland serveras middag bara för hotellgäster.</li>
</ul>

<h2>Alla slott där man kan bo</h2>
<p>Vi har samlat ${list('bo-pa-slott').length} slott och herrgårdar i Sverige där man kan övernatta. Välj län för att se dem i det område ni vill resa till.</p>`,
  },
  {
    slug: 'slott-med-spa',
    cat: 'spa',
    title: 'Slott med spa i Sverige – alla slottshotell med spa',
    h1: 'Slott med spa',
    description: 'Alla slott och herrgårdar i Sverige med spa: från Gränsö och Hooks herrgård till fjällhotellet Fjällnäs. Vad varje ställe erbjuder och var de ligger.',
    lead: 'En spavistelse blir något särskilt i ett slott, med historiska salonger, parker och sjöutsikt. Här är alla slott och herrgårdar i Sverige som har spa, och vad som skiljer dem åt.',
    body: () => `
<h2>Spaslott nära Stockholm</h2>
<ul>
<li>${L('lejondals-slott')} i Bro: slott från sent 1800-tal av Isak Gustaf Clason vid Lejondalssjön, med poollounge och dagspa.</li>
<li>${L('skytteholm')} på Ekerö: nordiskt spa vid Mälaren, cirka 35 minuter från Stockholm.</li>
<li>${L('ulvsunda-slott')} i Bromma: slott från 1640-talet med spabehandlingar, mitt i Stockholm.</li>
<li>${L('nasby-slott')} i Täby: boutiquehotell med bastu och badtunna.</li>
<li>${L('johannesbergs-slott')} vid Gottröra: spa, restaurang och egen golfklubb.</li>
</ul>
<h2>Spaslott i Mälardalen och Uppland</h2>
<ul>
<li>${L('haga-slott')} vid Mälaren nära Enköping: slottshotell med spa och restaurang.</li>
<li>${L('sodertuna-slott')} vid Gnesta: slott på en holme i Frösjön, med relaxavdelning och engelsk park.</li>
<li>${L('soderfors-herrgard')} vid Dalälven: herrgård med relaxavdelning och bastuflotte.</li>
</ul>
<h2>Spaslott i södra Sverige</h2>
<ul>
<li>${L('granso-slott')} utanför Västervik: spa med åtta bassänger och bastur, på en ö i skärgården.</li>
<li>${L('hooks-herrgard')} söder om Jönköping: spa på 1 300 kvadratmeter och två golfbanor.</li>
<li>${L('toftaholm')} vid Vidöstern: herrgårdshotell med ekospa vid stranden.</li>
</ul>
<h2>Spa i fjällen</h2>
<ul>
<li>${L('fjallnas')} vid Tänndalen: Sveriges äldsta fjällhotell, grundat 1882, med spat Mii Gullo och dagspa.</li>
</ul>
<h2>Fler slott med bastu och bad</h2>
<p>Flera slott har inget riktigt spa men erbjuder bastu, badtunna eller bad i sjön. ${L('thorskogs-slott')} har bastu och vedeldade badtunnor på vintern, ${L('noors-slott')} har relaxavdelning med bastu och utomhusjacuzzi, och ${L('haringe-slott')} har pool och bastu.</p>
<h2>Tips inför spavistelsen</h2>
<ul>
<li>Fråga om spat ingår i rummet eller kostar extra, och om det finns dagspa för den som inte bor där.</li>
<li>Behandlingar behöver ofta bokas i förväg, särskilt på helger.</li>
<li>Kolla åldersgränsen. Många spa tar bara emot vuxna.</li>
</ul>`,
  },
];
