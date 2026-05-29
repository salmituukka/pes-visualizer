## Bugi

`src/lib/aggregate.ts`-tiedoston `matchesSlot`-funktiossa (rivit 32–44) `"any"` ja `"any_or_none"` käsitellään identtisesti — molemmat palauttavat `true` riippumatta siitä, onko pesällä pelaajaa vai ei. Tämän takia "Kuka tahansa" päästää läpi myös tilanteet, joissa pesä on tyhjä, vaikka sen kuuluisi vaatia jokin pelaaja pesällä.

## Korjaus

Muutetaan `matchesSlot` niin että:
- `"any"` → `actual !== null` (pesällä oltava joku pelaaja)
- `"any_or_none"` → `true` (sallii sekä pelaajan että tyhjän)
- `"measured"` → `true` (kuten ennen; rajaus tehdään `start_base`-tarkistuksella)
- `"none"`, `"player"` → ennallaan

Lyöjä-paikalla (`batter`) `batter_id` on käytännössä aina olemassa, joten korjaus ei vaikuta lyöjäsuodatukseen. Vaikutus kohdistuu etenijä-paikkoihin (1b/2b/3b), mikä on haluttu lopputulos.

## Muutettavat tiedostot

- `src/lib/aggregate.ts` — `matchesSlot` (rivit 32–44): erota `"any"` haarasta omakseen palauttamaan `actual !== null`.

Ei muita muutoksia; sama `matchesSlot` palvelee sekä `aggregateAtBatStats`, `aggregatePitchStats` että `aggregateDistribution` -funktioita.
