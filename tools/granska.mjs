// Tar skärmbilder av förhandsversionen (se .github/workflows/granska.yml).
// Indata: en fil med en sökväg per rad (t.ex. /slott/gransö-slott/), eller en hel adress (https://…) för att titta på en
// annan sida, t.ex. en rundtur. " start" efter sökvägen trycker på rundturens startknapp först. Rader som börjar med # hoppas över.
// Utdata: <namn>-dator.jpg och <namn>-mobil.jpg i utmappen.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [list, out] = process.argv.slice(2);
const BASE = process.env.GRANSKA_URL || 'https://granska-slottsregistret.konstadab.workers.dev';
const lines = readFileSync(list, 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
mkdirSync(out, { recursive: true });
const sizes = { dator: { width: 1440, height: 900 }, mobil: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 } };
const browser = await chromium.launch();
for (const [label, vp] of Object.entries(sizes)) {
  const { isMobile, deviceScaleFactor, ...viewport } = vp;
  const ctx = await browser.newContext({ viewport, isMobile, deviceScaleFactor: deviceScaleFactor || 1, locale: 'sv-SE' });
  for (const line of lines) {
    const [p, action] = line.split(/\s+/);
    const ext = /^https?:\/\//.test(p);
    const name = (action ? action + '-' : '') + (ext ? 'extern-' + p.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60) : p).replace(/^\/|\/$/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '') || 'start';
    if (action === 'text') { // läser en webbplats som byggs med JavaScript: startsidan och upp till 20 undersidor, texten sparas som JSON
      if (label !== 'dator') continue;
      const res = { start: p, pages: [] }; const page = await ctx.newPage();
      const read = async u => { await page.goto(u, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
        return page.evaluate(() => ({ url: location.href, title: document.title, text: document.body ? document.body.innerText.slice(0, 8000) : '',
          links: [...document.querySelectorAll('a[href]')].map(a => [a.href.split('#')[0], a.innerText.trim().slice(0, 80)]) })); };
      try {
        const first = await read(p); const host = new URL(first.url).hostname;
        res.pages.push({ url: first.url, title: first.title, text: first.text });
        const W = /br[öo]llop|fest|konferens|m[öo]te|boende|hotell|rum|spa|restaurang|meny|kaf|caf|bes[öo]k|visning|[öo]ppet|park|tr[äa]dg|historia|om|about|event|boka|paket/i;
        const seen = new Set([first.url]);
        const next = [...new Map(first.links.filter(([h]) => { try { return new URL(h).hostname === host && !/\.(jpe?g|png|pdf)$/i.test(h); } catch { return false; } }).map(l => [l[0], l])).values()]
          .filter(([h]) => !seen.has(h)).sort((a, b) => W.test(b.join(' ')) - W.test(a.join(' '))).slice(0, 20);
        for (const [h] of next) { const x = await read(h).catch(() => null); if (x && !seen.has(x.url)) { seen.add(x.url); res.pages.push({ url: x.url, title: x.title, text: x.text }); } }
      } catch (e) { res.error = String(e.message).slice(0, 160); }
      writeFileSync(`${out}/${name}.json`, JSON.stringify(res)); console.log('ok text', p, res.pages.length);
      await page.close(); continue;
    }
    const page = await ctx.newPage();
    try {
      await page.goto(ext ? p : BASE + p, { waitUntil: ext ? 'load' : 'networkidle', timeout: 45000 });
      if (ext) await page.waitForTimeout(8000); // rundturer laddar bilderna efter sidan
      // Rulla igenom sidan så att bilder som laddas sent kommer med.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(1500);
      if (action === 'skicka') { // fyller i obligatoriska fält med "Test" och skickar (för att se svaret på sidan)
        await page.evaluate(() => { const f = document.querySelector('form[data-form]'); f.querySelectorAll('[required]').forEach(el => { if (el.tagName === 'SELECT') el.selectedIndex = 1; else if (el.type === 'email') el.value = 'test@example.com'; else if (el.type === 'checkbox' || el.type === 'radio') el.checked = true; else el.value = 'Test från granskningen'; }); });
        await page.locator('form[data-form] [type=submit]').first().click(); await page.waitForTimeout(4000);
        // Gick det bra har sidan bytts till tacksidan; annars visas felrutan vid knappen.
        const kvar = page.locator('form[data-form] [type=submit]').first();
        if (await kvar.count()) await kvar.scrollIntoViewIfNeeded();
      }
      // Konton: "/konto/ loggain namn@exempel.se" ber om en inloggningslänk, "/konto/ansok/?slott=x ansok namn@exempel.se" skickar en ansökan
      // (bara i datorvarvet, så att det inte går iväg två gånger). En hel inloggningslänk som rad loggar in, och raderna efter ser då kontot.
      if ((action === 'loggain' || action === 'ansok') && label === 'dator') {
        const email = line.split(/\s+/)[2];
        if (action === 'loggain' && !(await page.locator('[data-action=logga-in]').isVisible())) { await ctx.clearCookies(); await page.reload({ waitUntil: 'networkidle' }); }
        const f = page.locator(action === 'loggain' ? '[data-action=logga-in]' : '[data-action=ansok]');
        if (action === 'ansok') { await f.locator('#namn').fill('Test från granskningen'); }
        await f.locator('[name=epost]').fill(email);
        page.on('response', async r => { if (r.url().includes('/api/')) console.log('svar', r.status(), r.url().replace(BASE, ''), (await r.text().catch(() => '')).slice(0, 400)); });
        await f.locator('[type=submit]').click(); await page.waitForTimeout(4000);
      }
      if (action === 'godkann' && label === 'dator') { // godkänner den första ansökan på /konto/granska/
        page.on('response', async r => { if (r.url().includes('/api/')) console.log('svar', r.status(), r.url().replace(BASE, ''), (await r.text().catch(() => '')).slice(0, 400)); });
        await page.locator('.review .btn-gold').first().click(); await page.waitForTimeout(3000);
      }
      if (action === 'profil' && label === 'dator') { // skickar in en provtext för det första slottet på /konto/
        page.on('response', async r => { if (r.url().includes('/api/')) console.log('svar', r.status(), r.url().replace(BASE, ''), (await r.text().catch(() => '')).slice(0, 400)); });
        const f = page.locator('.account-castle').first();
        await f.locator('textarea').fill('Provtext från granskningen. Den här texten ska inte synas på sajten.');
        await f.locator('[type=submit]').click(); await page.waitForTimeout(3000);
      }
      if (action === 'start') { const b = page.locator('.tour [data-start]').first(); await b.scrollIntoViewIfNeeded(); await b.click(); await page.waitForTimeout(10000); }
      await page.screenshot({ path: `${out}/${name}-${label}-topp.jpg`, type: 'jpeg', quality: 75 });
      await page.screenshot({ path: `${out}/${name}-${label}.jpg`, type: 'jpeg', quality: 60, fullPage: true });
      console.log('ok', label, p);
    } catch (e) { console.log('FEL', label, p, e.message); }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
