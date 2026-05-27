## Yleiskuva

Rakennetaan julkinen frontend, jossa käyttäjä porautuu sarja → kausi → lohko → joukkue → pelaajatilastot. Joukkuesivu lataa otteludatan tarvittaessa Edge Functionin kautta, kysyy aggregaattidatan suoraan `v_at_bat_participants_with_goals` ja `v_pitch_participants_with_goals` -näkymistä ja visualisoi onnistumisprosentit suodattimien mukaan.

## Reitit

```text
src/routes/
  __root.tsx                    (olemassa — päivitetään meta + layout)
  index.tsx                     (aloitussivu, dropdownit + joukkuelista)
  team.$teamId.tsx              (joukkueen tilastosivu)
```

Joukkueen sivulla käytetään search paramsia kontekstin (sarja/kausi/lohko) ja suodattimien (pesätilanne, lyöntinumero, mitattava, tavoite) säilyttämiseen URL:ssa — näin näkymä on jaettavissa ja päivitettävissä.

## Aloitussivu (`/`)

Komponentit:
- `SeriesSelect` — listaa uniikit sarjanimet (`series.series_name`) joissa on otteluita kuluvalla kaudella. Oletus: aakkosjärjestys.
- `SeasonSelect` — kun sarja valittu, näytä vuodet joilta löytyy `season_series` valitulle `series_id`:lle. Oletus uusin (2026).
- `GroupSelect` — kun kausi valittu, näytä `series_groups` valitulle `season_series_id`:lle. Jos vain yksi → autom. valinta.
- `TeamList` — kun lohko valittu, näytä `team_in_series_group` → `teams` (+ `sport_clubs.logo_url`) klikattavana ruudukkona/listana logoineen.

Data: kaikki kysytään suoraan selaimesta `supabase`-clientillä (taulut ovat julkisia, RLS sallii SELECTin). TanStack Query loaderissa: `ensureQueryData` + komponentissa `useSuspenseQuery`.

Klikkaus joukkueesta vie reittiin:
`/team/$teamId?seasonSeriesId=…&groupId=…`

## Joukkueen sivu (`/team/$teamId`)

Search params:
- `seasonSeriesId`, `groupId` (konteksti murupolulle)
- `runner1`, `runner2`, `runner3` — pesillä olevat pelaaja-id:t (tai erityisarvot `none`/`measured`)
- `measured` — kumpi pesä on "mitattava" (1/2/3, valinnainen)
- `hitNumber` — 1, 2, 3, `any-single`, `turn` (oletus `turn`)
- `goal` — `lead_advance`, `tail_advance`, `no_outs` (näkyy vain jos `measured` asetettu)

Validointi Zodilla `validateSearch`-funktiossa.

### Layout
- Header: murupolku (Sarja → Kausi → Lohko → Joukkue, jokainen klikattava `<Link>`)
- Vasen palsta (mobiilissa Sheet):
  - `BaseFieldPicker` — SVG-pesäkenttävisualisaatio (timantti, 4 pesää). Jokaiselle pesälle dropdown jonka arvot: "Ei pelaajaa", "Mitattava", tai pelaajan nimi joukkueen rosterista. Toinen pieni toggle "Mitattava-pesä" (1/2/3).
  - `HitNumberRadio` — 1/2/3/yksittäinen/lyöntivuoro
  - `GoalSelect` — kärki-/takasiirtymä/ei paloja (disabloitu jos mitään mitattavaa ei valittu)
- Oikea palsta:
  - Latauksen progress-banneri ensikäynnillä
  - `StatsVisualization` — suodattimien mukaiset onnistumisprosentit pelaajittain (taulukko + barit). Kun "mitattava" on asetettu, näytetään valitun mitattavan pelaajan kohdalla success/failure/not_counted-jakauma; muutoin yhteenveto kaikista joukkueen pelaajista per rooli kyseisessä tilanteessa.

### Joukkueen pelaajien & otteluiden lataus (ensikäynti)

Mount-vaiheessa:
1. Tarkista `teams.last_player_sync` — jos > 7 pv tai null → kutsu `sync-team-players` Edge Functionia parametreilla `{ team_id, season_series_id }`.
2. Hae joukkueen ottelut (`matches`-taulusta missä `home_team_id` tai `away_team_id` = team_id ja `season_series_id` = valittu).
3. Suodata ottelut joista puuttuu event-data: `events_fetched_at IS NULL OR has_pitch_detail IS NULL`.
4. Kutsu `fetch-and-parse-match` rinnakkain (max 6 yhtäaikaa, semafori) puuttuville. Näytä `X/Y ottelua valmiina` -progress.
5. Kun valmis → invalidointi tilastonäkymäkyselyille.

### Tilastojen kysely

Pohjautuu kahteen näkymään:
- `v_at_bat_participants_with_goals` — kun `hitNumber = turn` (vuorotason tilastot, käytetään `goal_lead_advance` / `goal_tail_advance_runner` / `goal_tail_advance_batter`)
- `v_pitch_participants_with_goals` — kun `hitNumber` on yksittäinen ly (käytetään `goal_no_outs` ja vastaavat tarkemmat sarakkeet)

Yhteiset suodattimet:
- `season_series_id = ?`
- Pesätilanne: `effective_start_runner_1b/2b/3b` (vuorotaso) tai `start_runner_1b/2b/3b` (lyöntitaso) `IS NULL` / `= playerId`
- Lyöntinumero: tarvittaessa `hit_number = ?`
- Joukkue: `team_id = ?`
- Tavoitesarake = `'success'` / `'failure'` lasketaan ryhmittäin pelaajaa kohden.

Kyselyt tehdään suoraan selaimesta `supabase.from('v_...').select(...)`. Aggregointi (success/total) tehdään clientissä, koska PostgRESTillä se on hankalaa — taulujen koko per joukkue per kausi on hallittavissa.

## Suunnittelu

- Vaalea, urheilullinen tyyli. Semanttiset tokenit `src/styles.css` (lisätään `--success`, `--failure`, `--neutral` jne.).
- Komponentit shadcn/ui:sta (`Select`, `RadioGroup`, `Card`, `Sheet`, `Skeleton`, `Progress`, `Breadcrumb`).
- Pesäkenttä omana SVG-komponenttina.
- Responsiivinen: vasen palsta `Sheet`iin mobiilissa.

## Tekniset huomiot

- `src/integrations/supabase/types.ts` sisältää jo `v_at_bat_participants_with_goals` ja `v_pitch_participants_with_goals` → tyypitetty kysely toimii.
- Suoraan-selaimesta-kyselyt OK koska kaikki taulut/näkymät ovat julkisia (SELECT-policy `true`).
- Edge Functionit kutsutaan `supabase.functions.invoke('sync-team-players', { body: {...} })`-tyylillä — palauttaa JSONin. Ei tarvitse uutta backend-koodia.
- Rinnakkaisuuden rajoitus toteutetaan pienellä semaforilla (esim. `p-limit`-tyylinen oma utility, ei npm-pakettia).
- URL-tilanhallinta hoitaa jakamisen ja päivityksen ilman extra-state-managementia.

## Mitä EI tehdä tässä vaiheessa

- Admin-painikkeita bootstrap/sync-funktioille (käyttäjä trigg. Supabase-dashboardista)
- Autentikointia (julkinen sovellus)
- pg_cron / automaattista uudelleensynkronointia
- Lyöntikartan (hit_x/hit_y) heatmap-visualisointia — voidaan lisätä myöhemmin

## Rakennusvaiheet

1. Päivitä `__root.tsx` meta (otsikko sovellukselle, esim. "Pesistilastot")
2. Korvaa `index.tsx` aloitussivulla (dropdownit + joukkuelista)
3. Lisää `team.$teamId.tsx` reitti search params -validoinnilla ja layoutilla
4. Toteuta sub-komponentit: `Breadcrumb`, `BaseFieldPicker`, `HitNumberRadio`, `GoalSelect`, `StatsTable`, `LoadProgress`
5. Toteuta data-hookit: `useTeamRoster`, `useTeamMatches`, `useEnsureMatchEvents`, `useStats` (jakautuu at_bat / pitch -näkymiin)
6. Säädä `src/styles.css` semanttiset tokenit
