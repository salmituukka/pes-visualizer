## Tausta

Tietokannassa `role_at_start` saa parserin (`supabase/functions/_shared/parseMatch.ts` → `determineRole`) perusteella vain arvoja `"lead_runner"` tai `"tail_runner"`. Arvoa `"batter"` ei koskaan tallenneta — lyöjä tunnistetaan `start_base = 0` -arvosta.

## Bugi 1: kuollut `=== "batter"` -vertailu

`src/lib/aggregate.ts` rivi 174, funktiossa `rowSlot`:

```ts
default:
  return row.role_at_start === "batter" ? "batter" : null;
```

Tämä haara osuu vain kun `start_base` on `null` (ei 0–3). Vertailu `=== "batter"` ei voi koskaan onnistua, joten haara palauttaa aina `null`. Jos lyöjän rivi tulisi joskus ilman `start_base`-arvoa, slotti jäisi tunnistamatta.

**Korjaus:** vaihda vertailu vastaamaan oikeaa DB-arvoa. Lyöjä on aina kärki vuoron alussa, joten kun `start_base` on null mutta rooli on `"lead_runner"`, voidaan turvallisesti palauttaa `null` (ei batter-päättelyä) — tai jos halutaan säilyttää alkuperäinen tarkoitus, hyödynnetään `batter_id`-vertailua. Yksinkertaisin korjaus: poista koko `default`-fallback ja palauta vain `null`, koska parserin invariantti takaa että lyöjällä on `start_base = 0`.

```ts
default:
  return null;
```

## Bugi 2: `a.total += 1` kahdesti

`src/lib/aggregate.ts` `aggregateDistribution`-funktiossa rivit ~203–207:

```ts
if (!agg[slot]) agg[slot] = makeRow(slot, label);
const a = agg[slot]!;
a.total += 1;

a.total += 1;   // ← duplikaatti
```

Tämä nostaa `total`-laskuria kaksi kertaa per rivi, mikä vääristää jakauman absoluuttiset luvut (prosentit pysyvät oikein vain jos `else a.total -= 1` -haara osuu, joka kompensoi vain yhden lisäyksen). Lisäksi `r.end_base === r.start_base` -haarassa `stayed` lasketaan +1 mutta `total` on jo +2.

**Korjaus:** poista jälkimmäinen `a.total += 1;` -rivi.

## Tiedostot

- `src/lib/aggregate.ts` — kaksi pientä muutosta

Ei muutoksia edge-funktioihin, tyyppeihin (`supabase/functions/_shared/types.ts`:n `PlayerRole`-unionissa oleva `'batter'` on harmiton, koska parser ei sitä koskaan tuota) eikä DB-skeemaan.
