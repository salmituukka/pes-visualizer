## Tavoite

Korvaa nykyinen "Lukumäärät"-taulukko (jakaumanäkymässä, eli kun mitattavaa ei ole valittu) "Odotusarvot"-taulukolla. Stacked-pylväs ja "Lopputilojen jakauma" -kortti säilyvät ennallaan.

## Taulukon sisältö

Yksi rivi, kuusi saraketta:

| Juoksut | Kärkietenemiset | Takaetenemiset | Haavoittumiset | Kärkipalot | Takapalot |

Arvot per ottelutapahtuma (lyöntinumero-tilassa per lyönti, lyöntivuoro-tilassa per lyöntivuoro). Näytä kaksi desimaalia.

Yläpuolelle "n = X tapahtumaa" -kuvaus.

## Laskentalogiikka

Nimittäjä N = distinct-ottelutapahtumien määrä, jotka täyttävät nykyiset pesätilanne- ja lyöntinumero-suodattimet.
- at_bat-tasolla: distinct (match_id, period, inning, bat_turn, at_bat_in_inning) suodatuksen jälkeen
- pitch-tasolla: distinct (..., hit_number) suodatuksen jälkeen

Osallistujarivien suodatus tehdään tapahtumatasolla: tapahtuma kelpaa jos sen pesätilanne (r1/r2/r3) ja batter täyttävät suodattimet ja lyöntinumero osuu (pitch-tasolla).

Per kelpaava tapahtuma, summataan kaikki osallistujarivit kyseiselle tapahtumalle:

- **Juoksut**: count(end_base = 4)
- **Kärkietenemiset**: sum yli role_at_start = 'lead_runner' osallistujista, max(0, end_base − start_base). Palanut (end_base = -1) → 0. Haavoittunut → 0.
- **Takaetenemiset**: sama kaava mutta role_at_start ∈ ('tail_runner', 'batter'). Lyöjä siis lasketaan AINA takaetenijäksi etenemis-laskussa — huom: lyöjä voi olla myös lead_runner; molemmat roolit voivat esiintyä, koska eri osallistujariveillä on omat roolinsa. Käytetään puhtaasti role_at_start-arvoa.
- **Haavoittumiset**: count(got_wounded = true)
- **Kärkipalot**: count(got_out = true AND role_at_start = 'lead_runner')
- **Takapalot**: count(got_out = true AND role_at_start ∈ ('tail_runner', 'batter'))

Odotusarvo = summa / N. Jos N = 0 → näytä "—".

## Tekninen toteutus

**src/lib/aggregate.ts**
- Lisää uusi tyyppi `ExpectedValues = { n: number; runs: number; leadAdvance: number; tailAdvance: number; wounded: number; leadOuts: number; tailOuts: number }`.
- Lisää funktio `aggregateExpectedValues(rows, filters, level)`:
  - Ryhmittele rivit tapahtuma-avaimella (`match_id|period|inning|bat_turn|at_bat_in_inning` + tarvittaessa `hit_number`).
  - Tarkista kunkin ryhmän pesätilanne (otetaan ensimmäiseltä riviltä) `matchesFilters`-funktiolla, ja pitch-tilassa hit_number-suodatin.
  - Jos kelpaa, kasvata N ja kerää summat yllä olevan logiikan mukaan kaikilta ryhmän osallistujariveiltä.
- Päivitä `AtBatRow`/`PitchRow`-tyypit sisältämään tapahtuma-avaimen kentät (match_id, period, inning, bat_turn, at_bat_in_inning, hit_number).

**src/lib/queries.ts**
- Varmista että `atBatParticipantsQueryOptions` ja `pitchParticipantsQueryOptions` valitsevat tapahtuma-avaimen sarakkeet (jos eivät vielä).

**src/components/distribution-display.tsx**
- Lisää uusi propsi `expected: ExpectedValues`.
- Korvaa "Lukumäärät"-kortti "Odotusarvot"-kortilla:
  - Otsikko: "Odotusarvot" + alaotsikko "per lyönti" tai "per lyöntivuoro" sen mukaan kumpaa dataa katsotaan
  - Taulukko 6 sarakkeella, kukin arvo 2 desimaalin tarkkuudella; `—` jos n = 0
  - Pieni "n = X" -teksti

**src/routes/team.$teamId.tsx**
- Laske `expected` `useMemo`:ssa kuten `distributionRows`, ja välitä `DistributionDisplay`:lle. Lisää `level`-tieto otsikon yksikön valintaa varten.

## Mitä ei muuteta

- "Lopputilojen jakauma" -kortti (stacked-pylväät) jää ennalleen.
- Ranking-näkymä (StatsDisplay, mitattava valittuna) jää ennalleen.
- Ei tietokantamuutoksia.
