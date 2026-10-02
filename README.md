# Slottsregistret.se

Register över Sveriges slott, borgar, fästningar och slottsmiljöer – med fokus på att kunna se dem inifrån via virtuella rundturer.
Byggs på samma grund som svenskakyrkor.se: statisk sajt som publiceras som Cloudflare Worker.

- `data/slott.json` – grundlistan (namn, typ, kommun, län, användning, öppet, prioritet).
- `tools/hamta.mjs` + `.github/workflows/hamta.yml` – hämtar öppna data (arbetsmiljön når inte Wikidata m.fl.).
