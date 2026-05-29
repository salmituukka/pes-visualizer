import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributionRow, ExpectedValues } from "@/lib/aggregate";

const SEGMENTS: { key: keyof DistributionRow; color: string; label: string }[] = [
  { key: "scored", color: "bg-emerald-500", label: "Juoksu" },
  { key: "reached_3b", color: "bg-green-400", label: "3b" },
  { key: "reached_2b", color: "bg-blue-400", label: "2b" },
  { key: "reached_1b", color: "bg-sky-400", label: "1b" },
  { key: "wounded", color: "bg-yellow-400", label: "Haavoittui" },
  { key: "stayed", color: "bg-gray-400", label: "Pysyi" },
  { key: "out", color: "bg-red-500", label: "Paloi" },
];

function StackedBar({ row }: { row: DistributionRow }) {
  if (row.total === 0) return null;
  return (
    <div className="flex h-6 w-full overflow-hidden rounded-md">
      {SEGMENTS.map((s) => {
        const value = row[s.key] as number;
        const pct = (value / row.total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={s.key as string}
            className={s.color}
            style={{ width: `${pct}%` }}
            title={`${s.label}: ${value} (${pct.toFixed(0)}%)`}
          />
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {SEGMENTS.map((s) => (
        <div key={s.key as string} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm ${s.color}`} />
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export function DistributionDisplay({
  rows,
  totalEvents,
  expected,
  level,
}: {
  rows: DistributionRow[];
  totalEvents: number;
  expected: ExpectedValues;
  level: "at_bat" | "pitch";
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ei tuloksia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Valituilla suodattimilla ei löytynyt tapahtumia. (Tapahtumia käsitelty: {totalEvents})
          </p>
        </CardContent>
      </Card>
    );
  }

  const unitLabel = level === "pitch" ? "per lyönti" : "per lyöntivuoro";
  const fmt = (v: number) => (expected.n === 0 ? "—" : (v / expected.n).toFixed(2));

  const cols: { label: string; value: number }[] = [
    { label: "Juoksut", value: expected.runs },
    { label: "Kärkietenemiset", value: expected.leadAdvance },
    { label: "Takaetenemiset", value: expected.tailAdvance },
    { label: "Haavoittumiset", value: expected.wounded },
    { label: "Kärkipalot", value: expected.leadOuts },
    { label: "Takapalot", value: expected.tailOuts },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lopputilojen jakauma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Legend />
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.slot} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground">n = {r.total}</span>
                </div>
                <StackedBar row={r} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Odotusarvot</CardTitle>
          <p className="text-xs text-muted-foreground">
            {unitLabel} · n = {expected.n}
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {cols.map((c) => (
                    <th key={c.label} className="pb-2 text-right first:text-left">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {cols.map((c) => (
                    <td key={c.label} className="py-2 text-right tabular-nums first:text-left">
                      {fmt(c.value)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
