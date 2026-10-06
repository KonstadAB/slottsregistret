#!/usr/bin/env node
// Kartlägger vilka boknings-, biljett-, presentkorts- och affiliatesystem slotten (och andra platser) använder på sina
// egna webbplatser. Körs i GitHub Actions (.github/workflows/bokning.yml) när data/source/bokning-lista.json ändras på
// en claude/-gren. Läser startsidan och upp till MAX relevanta undersidor per webbplats (boka, bröllop, konferens, spa,
// biljetter, presentkort …), plus bokningsdomäner på egna underdomäner (boka.x.se), och sparar för varje sida
// externa domäner (skript, ramar, länkar, formulär) och träffar på kända leverantörer i data/source/bokning-svar.json.
//
// Lista: [{ id, name, url, group? }]
import fs from 'node:fs';
import dns from 'node:dns/promises';

const IN = 'data/source/bokning-lista.json', OUT = 'data/source/bokning-svar.json';
const MAX = 14;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const list = JSON.parse(fs.readFileSync(IN, 'utf8'));
const out = { fetched: new Date().toISOString(), sites: {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Kända leverantörer: namn -> mönster i rå HTML (skript, ramar, länkar).
const VENDORS = {
  'Bookvisit': /bookvisit\.com/i, 'Citybreak': /citybreak\.com/i, 'Mews': /mews\.(com|li)|mews-distributor/i,
  'Sirvoy': /sirvoy\.com/i, 'SiteMinder': /siteminder|thebookingbutton|direct-book\.com/i, 'Cloudbeds': /cloudbeds\.com/i,
  'Little Hotelier': /littlehotelier/i, 'Profitroom': /profitroom/i, 'SynXis': /synxis\.com|travelclick/i,
  'Bookassist': /bookassist/i, 'Visbook': /visbook\.com/i, 'Planyo': /planyo\.com/i, 'Checkfront': /checkfront\.com/i,
  'Bokun': /bokun\.(io|is)|widgets\.bokun/i, 'FareHarbor': /fareharbor\.com/i, 'Regiondo': /regiondo\./i,
  'Rezdy': /rezdy\.com/i, 'Ventrata': /ventrata\.com/i, 'Peek': /peek\.com\/|book\.peek\./i, 'Turitop': /turitop\.com/i,
  'Bókun/Tripadvisor': /tripadvisor\.[a-z.]+\/.*(Attraction|Hotel)_Review/i, 'GetYourGuide': /getyourguide\./i, 'Viator': /viator\.com/i,
  'Booking.com': /booking\.com/i, 'Expedia/Hotels.com': /expedia\.|hotels\.com/i, 'Airbnb': /airbnb\./i,
  'Tickster': /tickster\.com/i, 'Billetto': /billetto\./i, 'Ticketmaster': /ticketmaster\./i, 'Eventbrite': /eventbrite\./i,
  'Nortic': /nortic\.se/i, 'Ebiljett': /ebiljett\.nu/i, 'TicketCo': /ticketco\.(events|no|se)/i, 'Biljettkiosken': /biljettkiosken/i,
  'Kulturbiljetter': /kulturbiljetter/i, 'Ticnet/Live Nation': /ticnet\.se|livenation\./i, 'Secure Ticketing': /secure\.tickster|tixly/i,
  'Lyyti': /lyyti\./i, 'Invajo': /invajo\./i, 'Eventor/Simpleevent': /simpleevent|eventor\./i,
  'Caspeco': /caspeco/i, 'BokaBord': /bokabord\.se/i, 'Waiteraid': /waiteraid/i, 'TheFork': /thefork\.|lafourchette/i,
  'OpenTable': /opentable\./i, 'Resengo': /resengo/i, 'Zenchef': /zenchef/i, 'Eatery/Truebooking': /truebooking|bokningsportal/i,
  'Bokadirekt': /bokadirekt\.se/i, 'Zoezi': /zoezi/i, 'SimplyBook': /simplybook\./i, 'Fresha': /fresha\.com/i, 'Booksy': /booksy\./i,
  'Timecenter': /timecenter\./i, 'Spabooker': /spabooker/i, 'Hogia/Ascend': /ascend\.se|hogia/i,
  'Superpresent/Presentkortet': /superpresent|presentkortet\.se/i, 'Smartbox/Upplevelsepresent': /smartbox|upplevelsepresent|upplevelse\.se/i,
  'GoGift': /gogift/i, 'Giftcard (Caspeco/Wiretec m.fl.)': /giftcard\.|presentkort\.[a-z]+\.se|giftup|gift-up/i,
  'Ackroo/Zaver': /zaver\.|ackroo/i, 'Shopify': /cdn\.shopify|myshopify/i, 'WooCommerce': /woocommerce/i, 'Klarna': /klarna/i,
  'Stripe': /js\.stripe\.com/i, 'Svea/Payson/Nets': /svea\.com|payson|nets\.eu|dibspayment/i,
  'Adtraction': /adtraction/i, 'Awin': /awin1?\.com|zanox/i, 'Tradedoubler': /tradedoubler/i, 'Partner-ads': /partner-ads/i,
  'Stay22': /stay22/i, 'Travelpayouts': /travelpayouts|tp\.media/i, 'Booking affiliate': /booking\.com\/[^"']*[?&]aid=/i,
  'Venuu': /venuu\./i, 'Bröllopstorget': /brollopstorget/i, 'Lokalbokning/Lokalguiden': /lokalguiden|lokalbokning/i,
  'Meetingselect/Venue': /meetingselect|venue\.se|konferensbokning|bookameeting/i, 'Visit Sweden/Visita': /visitsweden\.|visita\.se/i,
  'HubSpot': /hubspot|hs-scripts|hsforms/i, 'Typeform': /typeform\./i, 'Jotform': /jotform\./i, 'Gravity Forms': /gravityforms|gform_/i,
  'Mailchimp': /mailchimp|list-manage\.com/i, 'Calendly': /calendly\./i, 'Matterport': /matterport\./i,
  'GolfBox': /golfbox\./i, 'MinGolf': /mingolf\.golf\.se|mingolf\.se/i, 'Golfamore': /golfamore/i,
};
// Undersidor värda att läsa (adress eller länktext).
const REL = /bok|book|reserv|hotell|hotel|rum\b|rooms?|logi|övernatt|overnatt|stay|bröllop|brollop|wedding|fest|konferens|conference|meeting|möte|mote|spa|restaurang|restaurant|äta|ata\b|dining|lunch|middag|biljett|ticket|presentkort|gift|evenemang|event|kalender|besök|besok|visit|öppettider|oppettider|paket|erbjud|shop|butik|guidad|visning|priser|köp|kop\b/i;
const BOOKTXT = /boka|book|reserv|biljett|ticket|köp|kop\b|presentkort|gift ?card|beställ|bestall|förfrågan|forfragan|offert|check.?in|lediga/i;
const SKIP = /google|gstatic|googletag|doubleclick|facebook|fbcdn|instagram|twitter|x\.com|linkedin|youtube|ytimg|vimeo|cookiebot|cookieinformation|onetrust|cloudflare|jsdelivr|jquery|fontawesome|fonts\.|typekit|wp\.com|wordpress\.org|gravatar|w3\.org|schema\.org|hotjar|tiktok|pinterest|apple\.com|microsoft|bing\.|unpkg|cdnjs|bootstrap|polyfill|addtoany|sharethis|recaptcha|maps\.|openstreetmap|leaflet/i;

const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const root = h => h.split('.').slice(-2).join('.');

async function load(u) {
  try {
    const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*', 'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const html = (r.headers.get('content-type') || '').includes('html') ? (await r.text()).slice(0, 1500000) : '';
    return { status: r.status, final: r.url || u, html };
  } catch (e) { return { status: 0, final: u, html: '', error: String(e.cause && (e.cause.code || e.cause.message) || e.name || e).slice(0, 120) }; }
}

function parse(html, base) {
  const abs = h => { try { return new URL(h.replace(/&amp;/g, '&').trim(), base).href; } catch { return null; } };
  const title = ((html.match(/<title[^>]*>([^<]*)/i) || [])[1] || '').trim().slice(0, 120);
  const ext = { script: new Set(), iframe: new Set(), form: new Set(), link: new Set() };
  for (const m of html.matchAll(/<script\b[^>]*?\ssrc=["']([^"']+)/gi)) { const a = abs(m[1]); if (a) ext.script.add(a); }
  for (const m of html.matchAll(/<iframe\b[^>]*?\s(?:data-)?src=["']([^"']+)/gi)) { const a = abs(m[1]); if (a) ext.iframe.add(a); }
  for (const m of html.matchAll(/<form\b[^>]*?\saction=["']([^"']+)/gi)) { const a = abs(m[1]); if (a) ext.form.add(a); }
  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*?\shref=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const a = abs(m[1]); if (!a || !/^https?:/.test(a)) continue;
    const t = m[2].replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim().slice(0, 80);
    links.push([a, t]); ext.link.add(a);
  }
  const vendors = Object.entries(VENDORS).filter(([, re]) => re.test(html)).map(([n]) => n);
  return { title, ext, links, vendors };
}

async function scan(site) {
  const res = { name: site.name, url: site.url, group: site.group || 'slott', pages: [], vendors: {}, hosts: {}, bookLinks: [], subdomains: {} };
  const first = await load(site.url);
  const mainHost = host(first.final) || host(site.url), mainRoot = root(mainHost);
  const seen = new Set(), queue = [[first.final, first]];
  const extra = new Set();
  const add = (v, where) => { (res.vendors[v] = res.vendors[v] || []).length < 4 && !res.vendors[v].includes(where) && res.vendors[v].push(where); };
  while (queue.length && res.pages.length < MAX + 1) {
    const [u, pre] = queue.shift();
    const key = u.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (seen.has(key)) continue; seen.add(key);
    const p = pre || await load(u);
    res.pages.push({ url: u, status: p.status, final: p.final !== u ? p.final : undefined, error: p.error, bytes: p.html.length });
    if (!p.html) continue;
    const { title, ext, links, vendors } = parse(p.html, p.final);
    res.pages[res.pages.length - 1].title = title;
    for (const v of vendors) add(v, p.final);
    for (const [kind, set] of Object.entries(ext)) for (const a of set) {
      const h = host(a); if (!h || root(h) === mainRoot && h === mainHost || SKIP.test(h)) continue;
      const e = res.hosts[h] = res.hosts[h] || { kinds: [], sample: a.slice(0, 200) };
      if (!e.kinds.includes(kind)) e.kinds.push(kind);
      // Egen underdomän (boka.x.se, shop.x.se): läs den också och ta reda på vem som driver den.
      if (root(h) === mainRoot && h !== mainHost && kind === 'link') extra.add(a);
    }
    const cands = [];
    for (const [a, t] of links) {
      const h = host(a);
      if (BOOKTXT.test(t) || BOOKTXT.test(a.replace(/^https?:\/\/[^/]+/, ''))) {
        if (res.bookLinks.length < 40 && !res.bookLinks.some(b => b[0] === a)) res.bookLinks.push([a.slice(0, 250), t]);
      }
      if (h === mainHost && !/\.(pdf|jpe?g|png|gif|webp|zip|docx?|xlsx?|mp4)(\?|$)/i.test(a) && (REL.test(a.replace(/^https?:\/\/[^/]+/, '')) || REL.test(t))) {
        cands.push([a, (/bok|book|reserv|biljett|ticket|presentkort|gift/i.test(a + t) ? 0 : 1)]);
      }
    }
    if (res.pages.length === 1) cands.sort((x, y) => x[1] - y[1]).forEach(([a]) => queue.push([a]));
  }
  for (const a of [...extra].slice(0, 4)) {
    const h = host(a);
    if (res.subdomains[h]) continue;
    let cname = null; try { cname = (await dns.resolveCname(h))[0] || null; } catch { }
    const p = await load(a);
    const v = p.html ? parse(p.html, p.final).vendors : [];
    res.subdomains[h] = { cname, status: p.status, final: p.final, title: p.html ? parse(p.html, p.final).title : '', vendors: v };
    for (const x of v) add(x, p.final);
  }
  return res;
}

const queue = [...list];
let done = 0;
async function worker() {
  for (let s; (s = queue.shift());) {
    try { out.sites[s.id] = await scan(s); } catch (e) { out.sites[s.id] = { name: s.name, url: s.url, error: String(e).slice(0, 200) }; }
    if (++done % 10 === 0) { console.log('Klara', done, 'av', list.length); fs.writeFileSync(OUT, JSON.stringify(out)); }
    await sleep(100);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('Klart', Object.keys(out.sites).length, 'webbplatser');
