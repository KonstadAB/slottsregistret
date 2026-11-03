-- Konton för slotten (Cloudflare D1, bindningen DB). Kör: npx wrangler d1 migrations apply slottsregistret --remote
-- Inloggning med engångslänk via e-post, inga lösenord. Allt som slotten ändrar granskas av Daniel innan det syns.

CREATE TABLE users (
  id          TEXT PRIMARY KEY,            -- slumpat id
  email       TEXT NOT NULL UNIQUE,        -- små bokstäver
  name        TEXT,
  phone       TEXT,
  created_at  TEXT NOT NULL,
  last_login  TEXT
);

-- Vem som får sköta vilket slott. Ansökan blir 'pending' tills Daniel godkänner den.
CREATE TABLE memberships (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  castle      TEXT NOT NULL,               -- slottets slug, t.ex. 'svaneholms-slott'
  role        TEXT,                        -- vad personen själv skrev: ägare, förvaltare …
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  created_at  TEXT NOT NULL,
  decided_at  TEXT,
  UNIQUE (user_id, castle)
);
CREATE INDEX memberships_castle ON memberships(castle);

-- Engångslänkar för inloggning (bara hashen sparas), giltiga 30 minuter.
CREATE TABLE login_tokens (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  expires_at  TEXT NOT NULL,
  used_at     TEXT
);

-- Inloggade webbläsare (bara hashen sparas), giltiga 30 dagar.
CREATE TABLE sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  created_at  TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

-- Slottens uppgifter, en rad per inskickad version. Den senaste godkända versionen är den som syns på sajten.
CREATE TABLE profiles (
  id          TEXT PRIMARY KEY,
  castle      TEXT NOT NULL,
  data        TEXT NOT NULL,               -- JSON: text, erbjudanden, webbplats, bokning, telefon, e-post, öppet
  user_id     TEXT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'replaced')),
  note        TEXT,                        -- Daniels kommentar vid nej
  created_at  TEXT NOT NULL,
  decided_at  TEXT
);
CREATE INDEX profiles_castle ON profiles(castle, status);
