## Toinen sama bugi

`src/components/base-field-picker.tsx` -tiedoston `matchesRunnerSlot`-funktiossa (rivit 61–73) on identtinen bugi: `"any"` ja `"any_or_none"` käsitellään samoin (molemmat `return true`). Tämä vaikuttaa pesäpallokenttä-visualisaation **lyöntipisteisiin** (väriympyrät kentällä) — ne näytetään myös pesätilanteissa, joissa "Kuka tahansa" -pesä on tyhjä.

## Korjaus

Sama kuvio kuin `aggregate.ts`:ssa:

```ts
case "any":
  return value !== null;
case "any_or_none":
case "measured":
  return true;
```

## Tarkistettu, ei muita esiintymiä

Tämä on ainoa muu paikka koodikannassa, jossa slot-arvoja matchataan dataan. Muut `parseSlot`-käyttäjät:
- `src/lib/filters.ts` `hasMeasured` — tarkistaa vain `kind === "measured"`, ei matchausta.
- `src/lib/aggregate.ts` `aggregateDistribution` (rivi 226) — käyttää `s.kind`:iä päättääkseen mitkä slotit *näytetään* jakaumassa (none/measured pois), ei rivien suodatukseen.
- `base-field-picker.tsx` `SlotMarker` (rivi 272) — vain visuaalinen renderöinti.

## Muutettavat tiedostot

- `src/components/base-field-picker.tsx` rivit 61–73: erota `"any"` omaksi haaraksi palauttamaan `value !== null`.
