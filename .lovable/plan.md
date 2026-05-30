## Tavoite

Lisätään keskeneräisten / liian aikaisin parsittujen otteluiden automaattinen tunnistus ja uudelleenparsinta, sekä manuaalinen "Päivitä"-nappi yksittäisen ottelun näkymään.

Spec on hyvin määritelty ja toteutettavissa. Alla muutamia tarkennuksia ja yksi pieni huomio.

## Arvio specistä

Spec on järkevä. Yksi tekninen huomio: nykyinen `shouldFetchMatch` (supabase/functions/_shared/fetchAndParse.ts) ohittaa otteluen jos `events_available === true` ja sillä on 1 min "concurrent fetch" -lukko. Uudelleenparsinta vaatii `force`-lipun joka ohittaa molemmat — tämä on pieni lisäys edge functioniin, ei iso muutos.

Yksi pieni epäjohdonmukaisuus spec:ssä: 30 min throttle on jo periaatteessa hoidettu kannassa (`events_fetched_at`), joten Logic 1 voi luottaa siihen suoraan eikä erillistä client-side throttlea tarvita. Logic 2:n 30 s nappi-throttle hoidetaan komponentin tilassa.

## Muutokset

### 1. Edge function: `force`-lippu

**`supabase/functions/_shared/fetchAndParse.ts`**
- `fetchAndParseMatch(supabase, match_id, match_date_iso, apiKey, opts?: { force?: boolean })`
- Jos `force=true`, ohitetaan `shouldFetchMatch` kokonaan ja edetään suoraan API-hakuun + tallennukseen (saveMatch on jo upsert-pohjainen, joten uudelleenkirjoitus toimii).

**`supabase/functions/fetch-and-parse-match/index.ts`**
- Hyväksy `force: boolean` request bodyssa (sekä yksittäis- että batch-muoto).
- Propagoi `fetchAndParseMatchBatch`-läpi.

### 2. Logiikka 1: automaattinen uudelleenparsinta

**`src/lib/match-sync.ts`**
- Uusi `needsReparsing(match)`:
  ```
  const now = Date.now();
  const matchTime = match.match_date ? new Date(match.match_date).getTime() : null;
  if (!matchTime || matchTime > now) return false;              // tulevaisuus
  if (now - matchTime > 30*24*3600*1000) return false;          // > 1 kk
  const lastFetch = match.events_fetched_at ? new Date(match.events_fetched_at).getTime() : null;
  if (lastFetch && now - lastFetch < 30*60*1000) return false;  // < 30 min sitten
  const notParsedOk = match.events_available !== true;
  const parsedTooEarly = lastFetch !== null
    && lastFetch < matchTime + 6*3600*1000;
  return notParsedOk || parsedTooEarly;
  ```
- Päivitetään `parseMissingMatches` → `parsePendingMatches(matches, onProgress)`:
  - Erottelee:
    - `missing` = ei `events_fetched_at` → kutsu ilman `force`.
    - `reparse` = `needsReparsing(m) === true` ja `events_fetched_at` olemassa → kutsu `force: true`.
  - Sama 6 workerin rinnakkaisuus.
- Säilytetään vanha funktioneme exporttina yhteensopivuuden vuoksi tai uudelleennimeä ja päivitä kutsupaikka.

**`src/routes/team.$teamId.tsx`**
- `useEffect`-haarassa lasketaan `pending = matches.filter(m => !m.events_fetched_at || needsReparsing(m))`.
- Jos `pending.length === 0 && team?.last_player_sync` → ei syncia.
- Kutsutaan `parsePendingMatches(pending, ...)` ja invalidoidaan samat cache-avaimet kuin nyt.

### 3. Logiikka 2: "Päivitä"-nappi

**Uusi komponentti `src/components/refresh-match-button.tsx`**
- Props: `matchId`, `matchDate`, `teamId`, `seasonSeriesId`.
- Näkyvyysehto: `matchDate < now && now - matchDate < 6h` (sekä menneisyydessä että ≤ 6 h sitten).
- Tila:
  - `loading` (parsinta käynnissä → spinner, disabled).
  - `cooldown` (viimeinen klikkaus < 30 s sitten → näyttää "Odota X s", disabled, sekuntilaskuri `useEffect`+`setInterval`).
  - `idle` → "Päivitä".
- Klikkauksessa:
  1. Aseta `loading`, tallenna `lastClickAt = Date.now()` (localStorage-avain `refresh-match:<matchId>` jotta selviää navigaatiosta — valinnainen, mutta suositeltava).
  2. `supabase.functions.invoke("fetch-and-parse-match", { body: { match_id, force: true } })`.
  3. Onnistuessa:
     - `queryClient.invalidateQueries({ queryKey: ["v-at-bat", teamId, seasonSeriesId] })`
     - sama avaimille: `v-pitch`, `opp-v-at-bat`, `opp-v-pitch`, `team-matches`, `pitch-points` (jos sellainen avain on; käytetään `predicate` joka tarkistaa `key[0]` starts-with).
  4. Virheessä: `toast.error("Päivitys epäonnistui, kokeile uudelleen")` (Sonner on jo käytössä).
  5. Lopuksi `setLoading(false)`, cooldown alkaa.

**`src/routes/team.$teamId.tsx`**
- Yhden ottelun valinnan yhteyteen (Select-komponentin viereen, kun `search.matchId` on asetettu) renderöi `<RefreshMatchButton ... />`.

### 4. Cache-avainten invalidointi

Käytetään `predicate`-muotoa varmistamaan kattava invalidointi:
```
queryClient.invalidateQueries({
  predicate: q => {
    const k = q.queryKey;
    return Array.isArray(k) && typeof k[0] === "string"
      && ["v-at-bat","v-pitch","opp-v-at-bat","opp-v-pitch","pitch-points","opp-pitch-points","team-matches"].includes(k[0])
      && k[1] === teamId && k[2] === seasonSeriesId;
  }
});
```

## Mitä EI muuteta

- Aggregointi, suodattimet, ulkopelinäkymä, RLS, tietokantaskeema.
- `saveMatch` (on jo idempotentti upsert).
- Sisäänpääsy / autentikointi.

## Avoin kysymys

Käytetäänkö napin cooldown-tilan säilyttämiseen `localStorage` (kestää sivulatauksen / navigaation yli) vai pelkkä komponentin tila (nollautuu navigoinnissa)? Spec ei pakota, mutta `localStorage` antaa todellisen spämmisuojan. Suositukseni: `localStorage`.