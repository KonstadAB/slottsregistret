// Tar skärmbilder av förhandsversionen (se .github/workflows/granska.yml).
// Indata: en fil med en sökväg per rad (t.ex. /slott/gransö-slott/), eller en hel adress (https://…) för att titta på en
// annan sida, t.ex. en rundtur. " start" efter sökvägen trycker på rundturens startknapp först. Rader som börjar med # hoppas över.
// Utdata: <namn>-dator.jpg och <namn>-mobil.jpg i utmappen.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

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
    const page = await ctx.newPage();
    try {
      await page.goto(ext ? p : BASE + p, { waitUntil: ext ? 'load' : 'networkidle', timeout: 45000 });
      if (ext) await page.waitForTimeout(8000); // rundturer laddar bilderna efter sidan
      // Rulla igenom sidan så att bilder som laddas sent kommer med.
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(1500);
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
