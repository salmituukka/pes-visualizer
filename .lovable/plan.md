
## Tavoite

Tuoda olemassa oleva TypeScript-backend (8 tiedostoa) Supabase Edge Functioneiksi, jotka parsivat Pesistulokset-API:n datan ja tallentavat sen jo olemassa oleviin tietokantatauluihin. Frontend rakennetaan myöhemmin.

## Lähtötilanne

- Tietokantataulut (`matches`, `at_bats`, `pitches`, `players`, `series`, `teams`, jne.) ovat jo olemassa.
- Salaisuus `PESISTULOKSET_API_KEY` on jo lisätty.
- Ladattu `backend.7z` sisältää 8 puhtaasti kirjasto-tyylistä moduulia (ei entry pointia / `Deno.serve`-kutsua).

Vaikka tämä projekti on TanStack Start (jossa oletus on `createServerFn`), käytämme tässä **Supabase Edge Functioneja** käyttäjän nimenomaisesta pyynnöstä — parsinta on pitkäkestoista taustatyötä ja koodi on jo Deno-yhteensopiva (`.ts`-importit).

## Tiedostorakenne

```text
supabase/functions/
  _shared/                       ← jaetut moduulit (kaikkien funktioiden käytössä)
    types.ts
    parseMatch.ts
    buildDatabaseRows.ts
    saveMatch.ts
    fetchAndParse.ts
    bootstrapSeries.ts
    syncResultBoard.ts
    syncTeamPlayers.ts
  bootstrap-series/index.ts      ← POST → kutsuu bootstrapSeries()
  sync-result-board/index.ts     ← POST { season_series_id, phase? }
  sync-team-players/index.ts     ← POST { team_id }
  fetch-and-parse-match/index.ts ← POST { match_id } tai { match_ids: [] }
```

## Edge Functionien tehtävät

| Funktio | Mitä tekee |
|---|---|
| `bootstrap-series` | Hakee `series-list`-rajapinnan, populoi `seasons`, `series`, `series_groups`, `sport_clubs`. Ajetaan kerran / kun uusi kausi alkaa. |
| `sync-result-board` | Populoi `teams` ja `team_in_series_group` annetulle sarjalle. |
| `sync-team-players` | Populoi `players` ja `matches` annetulle joukkueelle. |
| `fetch-and-parse-match` | Hakee yhden tai useamman ottelun event-datan, parsii sen ja tallentaa `at_bats`, `at_bat_participants`, `pitches`, `pitch_participants`, `segments`. |

Jokainen funktio:
- Käyttää `supabaseAdmin`-clientiä (service role) → ohittaa RLS:n, tarvitaan upserttejä varten.
- Lukee `PESISTULOKSET_API_KEY`:n `Deno.env.get()`-kutsulla.
- Palauttaa JSON-vastauksen lähdekoodin tulostyypeistä (`BootstrapResult`, `SyncResultBoardResult`, jne.).
- Toteuttaa CORS-headerit (`OPTIONS`-preflight + `Access-Control-Allow-Origin`).
- Loggaa virheet `console.error`-kutsuilla.

## Tekniset huomiot

- Jaetut moduulit menevät `supabase/functions/_shared/`-kansioon. Underscore-prefiksi estää Supabasea yrittämästä deployaa niitä omina funktioinaan.
- Lähdekoodin sisäiset `.ts`-importit (esim. `from './parseMatch.ts'`) toimivat Denossa sellaisenaan.
- `saveMatch.ts` käyttää `SupabaseLike`-rajapintaa → standardi Supabase-client toteuttaa sen suoraan.
- Pitkät funktiot (`bootstrap-series` ~30–60s) sopivat Edge Function -timeoutin sisään, mutta jos `fetch-and-parse-match` saa monta `match_id`:tä yhdellä kutsulla, harkitaan eräkokoa.

## Mitä EI tehdä tässä vaiheessa

- Ei frontend-UI:ta (tilastojen visualisointi, suodattimet) — käyttäjä rakentaa sen seuraavassa vaiheessa.
- Ei tietokantanäkymiä `at_bats`-aggregointiin — tulee myöhemmin kun visualisoinnit suunnitellaan.
- Ei automaattista skedulointia (pg_cron) — funktiot triggeroidaan manuaalisesti / frontendistä.

## Lopputulos

Neljä deployattua Edge Functionia, joita voi kutsua HTTP:n yli (esim. Supabase dashboardista tai `curl`-komennolla) populoimaan tietokanta. Valmis pohja frontendin rakentamiselle.
