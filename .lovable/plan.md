## Tavoite

Jakaumavisualisaatiossa (Tila A):
1. Lisätään aggregaattirivit niille sloteille joiden filtteri on "Kuka tahansa" tai "Kuka tahansa tai ei kukaan".
2. Rivien järjestys on kiinteä rooli-järjestys: **Lyöjä → 1-pesä → 2-pesä → 3-pesä**. Nimetty pelaaja korvaa otsikon kyseisessä paikassa, mutta järjestys ei muutu.

## Säännöt

- Yksi rivi per slot (`batter`, `runner1`, `runner2`, `runner3`), kiinteässä järjestyksessä yllä.
- Rivin sisältö riippuu slotin tilasta:
  - `player` (nimetty pelaaja) → rivi näyttää pelaajan nimen, data lasketaan vain riveistä joissa kyseinen pelaaja on tuossa roolissa.
  - `any` tai `any_or_none` → rivi näyttää otsikon "Lyöjä" / "1-pesä" / "2-pesä" / "3-pesä", data lasketaan kaikista riveistä joissa rooli on täytetty (kuka tahansa pelaaja).
  - `none` → rivi piilotetaan (slotti määritelmän mukaan tyhjä).
  - `measured` → ei näytetä (Tila B ottaa hoitaakseen, ei pitäisi tulla tähän koodipolkuun).
- Jos rivin otos = 0, rivi piilotetaan käyttäjän valinnan mukaisesti.
- `any_or_none`-tapauksessa aggregaatti lasketaan vain riveistä joissa rooli oli täytetty (vastaavasti kuin nykyinen `start_base !== null` -ehto edellytti).

## Muutokset

### `src/lib/aggregate.ts`

- Päivitä `DistributionRow` sisältämään `slot: "batter" | "runner1" | "runner2" | "runner3"` ja `label: string` (joko pelaajan nimi tai "Lyöjä"/"1-pesä"/jne.). `player_id` voidaan jättää, mutta avain on slot.
- Korvaa nykyinen `aggregateDistribution`-logiikka roolipohjaisella aggregoinnilla:
  - Käy slotit järjestyksessä `batter, runner1, runner2, runner3`.
  - Skipataan slot jos `none` tai `measured`.
  - Iteroi rivit; jokaiselle slotille poimi roolin haltija (batter_id / effective_start_runner_1b / 2b / 3b). Jos haltija puuttuu, ohita rivi tämän slotin osalta.
  - Jos slot = `player`, hyväksy vain rivit joissa haltija == valittu pelaaja-id.
  - Päivitä lopputilojen luokitus nykyisellä logiikalla (`got_out` → out, `got_wounded` → wounded, `end_base 4/3/2/1` → scored/3b/2b/1b, `end_base === start_base` → stayed).
- Palauta taulukko kiinteässä slot-järjestyksessä, suodata pois `total === 0`.

### `src/components/distribution-display.tsx`

- Renderöi rivit annetussa järjestyksessä (ei sortausta totalin mukaan enää).
- Rivin otsikkona käytetään `row.label`.

### Ei muutoksia

- `filters.ts`, `team.$teamId.tsx` (paitsi mahdollinen tyyppipäivitys jos tarpeen), queryt, `stats-display.tsx`.

## Hyväksymiskriteerit

- Rivien järjestys ylhäältä alas: Lyöjä → 1-pesä → 2-pesä → 3-pesä (paitsi piilotetut).
- Nimetty pelaaja näkyy oikean roolin paikalla, ei erillisenä lisärivinä.
- Slotit joissa "Ei kukaan" tai joista ei dataa eivät näy.
- "Kuka tahansa" / "Kuka tahansa tai ei kukaan" -slot näkyy roolin yleisnimellä.
