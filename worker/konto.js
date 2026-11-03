// Konton för slotten: /api/konto/… (inloggning, ansökan, slottets uppgifter, granskning) och /api/profiler.json.
//
// - Inloggning med engångslänk via e-post (bindningen EMAIL, Cloudflare Email Service), inga lösenord.
// - Ett slott söker om att få sköta sin sida (/konto/ansok/). Daniel godkänner i /konto/granska/ (administratörer i ADMIN_EMAILS).
// - Slottet skickar in sina uppgifter; de syns på sajten först när Daniel har godkänt dem.
// - /api/profiler.json visar de godkända uppgifterna (offentliga, de står ändå på sajten). Publiceringen hämtar dem
//   till data/slottsprofiler.json och bygger om sajten (.github/workflows/publicera.yml).
// Databasen är D1 (bindningen DB, tabellerna i migrations/). Saknas bindningarna svarar allt "kommer snart".
import { EmailMessage } from 'cloudflare:email';
import { mime } from './forms.js';

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;
const SLUG = /^[a-z0-9-]{2,80}$/;
const OFFERS = ['bo-pa-slott', 'spa', 'konferens', 'brollop-och-fest', 'restaurang-och-kafe', 'besok', 'park-och-tradgard'];
const DAY = 86400e3;
const COOKIE = 'konto';
const FROM = 'konto@slottsregistret.se';

const now = () => new Date().toISOString();
const rid = () => crypto.randomUUID().replace(/-/g, '');
const token = () => { const b = new Uint8Array(32); crypto.getRandomValues(b); return [...b].map(x => x.toString(16).padStart(2, '0')).join(''); };
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'cache-control': 'no-store', ...headers } });
const fail = (status, error) => json({ success: false, error }, status);
const clean = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const admins = env => String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);

// Slotten (namn och slug) från den byggda sajten, så att bara riktiga slott går att välja.
let CASTLES;
async function castles(env, origin) {
  if (!CASTLES) {
    const r = await env.ASSETS.fetch(new Request(origin + '/data/konto-slott.json'));
    CASTLES = r.ok ? new Map((await r.json()).map(c => [c.slug, c])) : new Map();
  }
  return CASTLES;
}

async function session(request, env) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|; )${COOKIE}=([a-f0-9]{64})`));
  if (!m) return null;
  const row = await env.DB.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?`)
    .bind(await sha(m[1]), now()).first();
  if (!row) return null;
  row.admin = admins(env).includes(row.email);
  return row;
}

async function body(request) {
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) return request.json();
  return Object.fromEntries((await request.formData()).entries());
}

async function sendLink(env, url, user) {
  const t = token();
  await env.DB.prepare('INSERT INTO login_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha(t), user.id, new Date(Date.now() + 30 * 60e3).toISOString()).run();
  const link = `${url.origin}/api/konto/lank?t=${t}`;
  const text = `Hej${user.name ? ' ' + user.name.split(' ')[0] : ''}!\n\nKlicka på länken för att logga in på Slottsregistret.se:\n${link}\n\nLänken fungerar i 30 minuter och bara en gång. Har du inte bett om den kan du strunta i det här mejlet.\n\nVänliga hälsningar\nSlottsregistret.se\n`;
  await env.EMAIL.send({ from: { email: FROM, name: 'Slottsregistret.se' }, to: user.email, subject: 'Din inloggningslänk till Slottsregistret.se', text, replyTo: 'kontakt@slottsregistret.se' });
}

// Meddelande till Daniel (samma väg som formulären).
async function tellAdmin(env, subject, text) {
  if (!env.MAIL || !env.MAIL_TO) return;
  const from = 'formular@slottsregistret.se';
  await env.MAIL.send(new EmailMessage(from, env.MAIL_TO, mime({ from: `Slottsregistret.se <${from}>`, to: env.MAIL_TO, subject, text })));
}

function cleanProfile(d) {
  const url = v => { const s = clean(v, 400); return /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(s) ? s : ''; };
  const p = {
    text: clean(d.text, 3000),
    offers: [].concat(d.offers || []).map(String).filter(o => OFFERS.includes(o)),
    website: url(d.website),
    booking: url(d.booking),
    phone: clean(d.phone, 40).replace(/[^\d +()-]/g, ''),
    email: EMAIL.test(clean(d.email, 200)) ? clean(d.email, 200).toLowerCase() : '',
    open: clean(d.open, 400),
  };
  return p;
}

export async function handleKonto(request, env, ctx) {
  try { return await konto(request, env, ctx); }
  catch (e) { console.log('Konto-fel:', e.stack || e.message); return json({ success: false, error: 'server', detail: String(e.message).slice(0, 300) }, 500); } // TILLFÄLLIGT: detail
}

async function konto(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path === '/api/profiler.json') return profilesExport(env);
  if (!env.DB) return fail(503, 'soon');
  // Bara anrop från sajten själv får ändra något.
  if (request.method === 'POST') {
    const origin = request.headers.get('origin');
    if (!origin || new URL(origin).host !== url.host) return fail(403, 'origin');
    if (env.FORM_LIMIT) {
      const { success } = await env.FORM_LIMIT.limit({ key: 'konto:' + (request.headers.get('cf-connecting-ip') || 'okänd') });
      if (!success) return fail(429, 'limit');
    }
  }
  const all = await castles(env, url.origin);

  // Ansökan om att få sköta ett slotts sida.
  if (path === '/api/konto/ansok' && request.method === 'POST') {
    const d = await body(request);
    if (String(d.webbplats || '').trim()) return json({ success: true }); // fällan för robotar
    const castle = clean(d.slott, 80), email = clean(d.epost, 200).toLowerCase(), name = clean(d.namn, 120);
    if (!SLUG.test(castle) || !all.has(castle)) return fail(400, 'castle');
    if (!EMAIL.test(email)) return fail(400, 'email');
    if (!name) return fail(400, 'required');
    let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) {
      user = { id: rid(), email, name, phone: clean(d.telefon, 40) };
      await env.DB.prepare('INSERT INTO users (id, email, name, phone, created_at) VALUES (?, ?, ?, ?, ?)').bind(user.id, email, name, user.phone, now()).run();
    }
    await env.DB.prepare(`INSERT INTO memberships (id, user_id, castle, role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, castle) DO UPDATE SET role = excluded.role, message = excluded.message,
        status = CASE WHEN memberships.status = 'approved' THEN 'approved' ELSE 'pending' END`)
      .bind(rid(), user.id, castle, clean(d.roll, 120), clean(d.meddelande, 2000), now()).run();
    ctx.waitUntil(tellAdmin(env, `Ny ansökan om konto – ${all.get(castle).name}`,
      `${name} (${clean(d.roll, 120) || 'roll ej angiven'}) vill sköta sidan för ${all.get(castle).name}.\nE-post: ${email}\nTelefon: ${clean(d.telefon, 40) || '–'}\n\n${clean(d.meddelande, 2000)}\n\nGodkänn eller neka: ${url.origin}/konto/granska/\n`).catch(e => console.log(e.message)));
    return json({ success: true });
  }

  // Be om en inloggningslänk. Svaret är detsamma oavsett om adressen finns, så att ingen kan pröva sig fram.
  if (path === '/api/konto/logga-in' && request.method === 'POST') {
    const d = await body(request);
    const email = clean(d.epost, 200).toLowerCase();
    if (!EMAIL.test(email)) return fail(400, 'email');
    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const ok = user && (admins(env).includes(email) ||
      await env.DB.prepare(`SELECT 1 FROM memberships WHERE user_id = ? AND status = 'approved'`).bind(user.id).first());
    if (ok && env.EMAIL) ctx.waitUntil(sendLink(env, url, user).catch(e => console.log('Inloggningslänken gick inte iväg:', e.code || '', e.message)));
    if (!user && admins(env).includes(email)) { // första inloggningen för en administratör
      const u = { id: rid(), email, name: '' };
      await env.DB.prepare('INSERT INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)').bind(u.id, email, '', now()).run();
      if (env.EMAIL) ctx.waitUntil(sendLink(env, url, u).catch(e => console.log(e.message)));
    }
    return json({ success: true });
  }

  // Länken i mejlet: loggar in och skickar vidare till kontot.
  if (path === '/api/konto/lank' && request.method === 'GET') {
    const t = url.searchParams.get('t') || '';
    if (!/^[a-f0-9]{64}$/.test(t)) return Response.redirect(url.origin + '/konto/?fel=lank', 303);
    const h = await sha(t);
    const row = await env.DB.prepare('SELECT * FROM login_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?').bind(h, now()).first();
    if (!row) return Response.redirect(url.origin + '/konto/?fel=lank', 303);
    const s = token();
    await env.DB.batch([
      env.DB.prepare('UPDATE login_tokens SET used_at = ? WHERE token_hash = ?').bind(now(), h),
      env.DB.prepare('INSERT INTO sessions (id_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha(s), row.user_id, now(), new Date(Date.now() + 30 * DAY).toISOString()),
      env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now(), row.user_id),
    ]);
    return new Response(null, { status: 303, headers: {
      location: url.origin + '/konto/',
      'set-cookie': `${COOKIE}=${s}; Path=/; Max-Age=${30 * 86400}; HttpOnly; Secure; SameSite=Lax`,
      'cache-control': 'no-store',
    } });
  }

  const me = await session(request, env);
  if (path === '/api/konto/logga-ut' && request.method === 'POST') {
    const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|; )${COOKIE}=([a-f0-9]{64})`));
    if (m) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha(m[1])).run();
    return json({ success: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
  }
  if (!me) return fail(401, 'login');

  // Mitt konto: slotten jag sköter, med senaste inskickade och senaste godkända uppgifter.
  if (path === '/api/konto/jag' && request.method === 'GET') {
    const { results: ms } = await env.DB.prepare('SELECT castle, status FROM memberships WHERE user_id = ? ORDER BY created_at').bind(me.id).all();
    const out = [];
    for (const m of ms) {
      const c = all.get(m.castle) || { slug: m.castle, name: m.castle };
      const latest = await env.DB.prepare('SELECT data, status, note, created_at FROM profiles WHERE castle = ? ORDER BY created_at DESC LIMIT 1').bind(m.castle).first();
      const live = await env.DB.prepare(`SELECT data, decided_at FROM profiles WHERE castle = ? AND status = 'approved' ORDER BY decided_at DESC LIMIT 1`).bind(m.castle).first();
      out.push({ slug: c.slug, name: c.name, current: c, membership: m.status,
        latest: latest && { ...latest, data: JSON.parse(latest.data) }, live: live && { ...live, data: JSON.parse(live.data) } });
    }
    return json({ success: true, user: { email: me.email, name: me.name, admin: me.admin }, castles: out, offers: OFFERS });
  }

  // Skicka in slottets uppgifter (granskas innan de syns).
  if (path === '/api/konto/profil' && request.method === 'POST') {
    const d = await body(request);
    const castle = clean(d.slott, 80);
    const m = await env.DB.prepare(`SELECT 1 FROM memberships WHERE user_id = ? AND castle = ? AND status = 'approved'`).bind(me.id, castle).first();
    if (!m && !me.admin) return fail(403, 'castle');
    const p = cleanProfile(d);
    await env.DB.batch([
      env.DB.prepare(`UPDATE profiles SET status = 'replaced', decided_at = ? WHERE castle = ? AND status = 'pending'`).bind(now(), castle),
      env.DB.prepare('INSERT INTO profiles (id, castle, data, user_id, created_at) VALUES (?, ?, ?, ?, ?)').bind(rid(), castle, JSON.stringify(p), me.id, now()),
    ]);
    ctx.waitUntil(tellAdmin(env, `Nya uppgifter att granska – ${(all.get(castle) || {}).name || castle}`,
      `${me.name || me.email} har skickat in nya uppgifter för ${(all.get(castle) || {}).name || castle}.\n\nGranska: ${url.origin}/konto/granska/\n`).catch(e => console.log(e.message)));
    return json({ success: true });
  }

  // Granskning (bara administratörer).
  if (path.startsWith('/api/konto/granska')) {
    if (!me.admin) return fail(403, 'admin');
    if (request.method === 'GET') {
      const { results: ms } = await env.DB.prepare(`SELECT m.id, m.castle, m.role, m.message, m.created_at, u.name, u.email, u.phone
        FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.status = 'pending' ORDER BY m.created_at`).all();
      const { results: ps } = await env.DB.prepare(`SELECT p.id, p.castle, p.data, p.created_at, u.name, u.email
        FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.status = 'pending' ORDER BY p.created_at`).all();
      return json({ success: true,
        memberships: ms.map(m => ({ ...m, castleName: (all.get(m.castle) || {}).name || m.castle })),
        profiles: ps.map(p => ({ ...p, data: JSON.parse(p.data), castleName: (all.get(p.castle) || {}).name || p.castle, current: all.get(p.castle) || null })) });
    }
    if (request.method === 'POST') {
      const d = await body(request);
      const yes = d.beslut === 'ja', id = clean(d.id, 40);
      if (d.typ === 'konto') {
        const m = await env.DB.prepare(`SELECT m.*, u.email, u.name FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.id = ?`).bind(id).first();
        if (!m) return fail(404, 'missing');
        await env.DB.prepare('UPDATE memberships SET status = ?, decided_at = ? WHERE id = ?').bind(yes ? 'approved' : 'rejected', now(), id).run();
        if (yes && env.EMAIL) ctx.waitUntil(env.EMAIL.send({ from: { email: FROM, name: 'Slottsregistret.se' }, to: m.email,
          subject: `Ni kan nu sköta ${(all.get(m.castle) || {}).name || m.castle} på Slottsregistret.se`,
          text: `Hej${m.name ? ' ' + m.name.split(' ')[0] : ''}!\n\nNu kan ni logga in och uppdatera uppgifterna om ${(all.get(m.castle) || {}).name || m.castle}: ${url.origin}/konto/\n\nAnge er e-postadress så får ni en inloggningslänk.\n\nVänliga hälsningar\nSlottsregistret.se\n` }).catch(e => console.log(e.message)));
        return json({ success: true });
      }
      if (d.typ === 'profil') {
        const p = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first();
        if (!p) return fail(404, 'missing');
        const stmts = [env.DB.prepare('UPDATE profiles SET status = ?, note = ?, decided_at = ? WHERE id = ?').bind(yes ? 'approved' : 'rejected', clean(d.note, 500), now(), id)];
        if (yes) stmts.unshift(env.DB.prepare(`UPDATE profiles SET status = 'replaced' WHERE castle = ? AND status = 'approved'`).bind(p.castle));
        await env.DB.batch(stmts);
        return json({ success: true });
      }
      return fail(400, 'typ');
    }
  }
  return fail(404, 'missing');
}

// De godkända uppgifterna för alla slott, för publiceringen.
async function profilesExport(env) {
  if (!env.DB) return json({});
  const { results } = await env.DB.prepare(`SELECT castle, data, decided_at FROM profiles WHERE status = 'approved'`).all();
  const out = {};
  for (const r of results) out[r.castle] = { ...JSON.parse(r.data), approved: r.decided_at };
  return json(out, 200, { 'cache-control': 'public, max-age=60' });
}
