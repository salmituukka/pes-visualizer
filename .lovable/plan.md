## Bugi

`src/routes/team.$teamId.tsx` riveillä 194 ja 200 tarkistetaan `!measured`, mutta `hasMeasured` (filters.ts) palauttaa `0 | 1 | 2 | 3 | null`. Kun lyöjä on mitattava, paluuarvo on `0`, ja `!0 === true` → Select disabloituu ja "aseta mitattava" -viesti näkyy vaikka mitattava on asetettu.

## Korjaus

Vaihda molemmat `!measured` → `measured === null`:

- rivi 194: `{measured === null && (`
- rivi 200: `disabled={measured === null}`
