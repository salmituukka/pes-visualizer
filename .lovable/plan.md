## Ulkopelinäkymä joukkueen sivulle

Lisätään joukkuesivulle Sisäpeli ↔ Ulkopeli -toggle. Ulkopelitilassa katsotaan
lyöntivuoroja, joissa **vastustaja** on lyömässä joukkueen otteluissa. Mitattava-
moodi ei ole käytössä, joten näytetään aina lopputilajakauma, odotusarvotaulukko
ja lyöntikartta.

### Käyttöliittymä

- Headerin otsikko: "Joukkueen nimi – Sisäpeli" / "– Ulkopeli". Otsikon viereen
  kompakti toggle (kaksi nappia: Sisäpeli | Ulkopeli).
- Toggle tallennetaan URL-paramiin `mode=offense|defense` (oletus `offense` =
  nykyinen sisäpelinäkymä). Muut suodattimet säilyvät vaihdossa, paitsi ne
  jotka eivät ole ulkopelissä mahdollisia (mitattava-arvot nollataan).

### Suodattimet ulkopelitilassa

- **Pesätilanne**: vain "Kuka tahansa" / "Ei kukaan" / "Kuka tahansa tai ei
  kukaan". Pelaajavalinta ja "Mitattava" piilotetaan kaikilta pesiltä ja
  lyöjältä. Jos URL:ssä on pelaaja-id tai `measured`, ne käsitellään kuten
  "Kuka tahansa".
- **Lyöntinumero**: sama kuin nyt (Lyöntivuoro / 1. / 2. / 3. / Mikä tahansa
  yksittäinen).
- **Ottelu**: sama suodatin.
- **Tavoite-kortti**: piilotetaan kokonaan (ei käytössä ilman mitattavaa).

### Visualisaatio

Aina "Mitattavaa ei valittu" -tila → näytetään:
1. **Lyöntikartta** (vastustajan lyönnit, joukkueen otteluista). Sama
   `pitchPointsQueryOptions`-rakenne, mutta haetaan ottelusta kaikki rivit,
   joiden `team_id ≠ teamId` ja `match` kuuluu joukkueen otteluihin.
2. **Lopputilajakauma** (`DistributionDisplay`).
3. **Odotusarvotaulukko** (`aggregateExpectedValues` → sama komponentti).

Mitattava-tilan ranking-näkymää (`StatsDisplay`) ei renderöidä.

### Tekninen toteutus

- **Reitti**: pysyy `/team/$teamId`. Lisätään `mode` searchSchemaan:
  `mode: fallback(z.enum(["offense","defense"]), "offense").default("offense")`.
- **Toggle**: pieni `Tabs`- tai kaksi-`Button`-komponentti headerissa, päivittää
  `mode`-paramin ja tarvittaessa nollaa pelaaja-ID:t / "measured"-arvot
  ulkopelitilaan vaihdettaessa.
- **Datakyselyt** (`src/lib/queries.ts`): lisätään uudet variantit, jotka
  hakevat saman season_series_id:n datan, mutta:
  - haetaan ensin joukkueen `match_id`-lista (`teamMatchesQueryOptions` jo
    olemassa) ja filtteröidään näkymäkyselyt `.in("match_id", matchIds)` +
    `.neq("team_id", teamId)`.
  - Uudet `queryOptions`: `opponentAtBatParticipantsQueryOptions`,
    `opponentPitchParticipantsQueryOptions`, `opponentPitchPointsQueryOptions`.
  - Query keyt esim. `["opp-v-at-bat", teamId, seasonSeriesId]` jotta
    cache ei sotkeudu sisäpelin kanssa.
- **`StatsSection`-komponentti**: lisätään `mode`-prop. Kun `defense`:
  - Käytetään opponent-kyselyitä.
  - Pakotetaan `measured = null` riippumatta URL-tilasta → aina
    `DistributionDisplay`.
  - `BaseFieldPicker`iin uusi `disablePlayers`-prop, joka piilottaa
    pelaajavalinnan ja Mitattava-vaihtoehdon dropdowneista; jos slotissa on
    pelaaja-id tai `measured`, käsitellään `any_or_none` / `any`:na.
- **Roster/sync**: pelaajien synkronointi tarvitaan vain sisäpelissä; ulkopeli
  ei tarvitse omaa rosteria. Ottelutapahtumat parsitaan joka tapauksessa
  joukkueen otteluista, joten ulkopelitila näkee saman datan automaattisesti
  kun sisäpelitila on käynyt sivulla.
- **Aggregointi** (`src/lib/aggregate.ts`): käyttää samoja funktioita; ne eivät
  oleta team_id:ta — riittää, että rivit on filtteröity oikein
  query-tasolla. Tämä varmistetaan testaamalla, ettei `aggregate*`-funktiot
  viittaa `teamId`-arvoon (nopea katsaus).

### Mitä EI muuteta

- Sisäpelinäkymä ja sen URL-yhteensopivuus.
- Aggregointilogiikka.
- Match-sync-virtaus (ulkopeli käyttää samaa parsittua dataa).