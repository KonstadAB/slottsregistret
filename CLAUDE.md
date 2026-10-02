# Slottsregistret.se

Läs `HANDOFF.md` innan du gör något. Där står beslut, struktur och vad som är gjort.

## Så arbetar du med Daniel
- Daniel äger sajten och är inte programmerare. Skriv på svenska, kort och enkelt, utan tekniska ord (inga filnamn, grenar, commits eller kommandon i svaren om han inte frågar).
- Gör allt du kan själv. Be honom bara om det som kräver hans inloggning, och guida då ett steg i taget med exakt vad han ska klicka på. Vänta på "klart" innan nästa steg.
- Tänk långsiktigt: välj lösningar vi inte växer ur. Lite högre kostnad är okej om det blir klart bättre.
- Samla ändringar och publicera när han ber om det. Säg till innan större ändringar publiceras.

## Nätet
Arbetsmiljön når bara GitHub. Allt annat (Wikidata, Wikipedia, Commons, OpenStreetMap, slottens webbplatser, Google, Cloudflare)
hämtas via GitHub Actions på en `claude/`-gren: `data/source/bestallning.json` + `tools/hamta.mjs`, och Cloudflare via
`data/source/cloudflare-kommando.txt` + `tools/cloudflare.mjs`. Svaren sparas på grenen (Actions-loggarna går inte att läsa härifrån).
