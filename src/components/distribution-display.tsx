import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DistributionRow } from "@/lib/aggregate";

const SEGMENTS: { key: keyof DistributionRow; color: string; label: string }[] = [
  { key: "scored", color: "bg-emerald-500", label: "Juoksu" },
  { key: "reached_3b", color: "bg-green-400", label: "3b" },
  { key: "reached_2b", color: "bg-blue-400", label: "2b" },
  { key: "reached_1b", color: "bg-sky-400", label: "1b" },
  { key: "wounded", color: "bg-yellow-400", label: "Haavoittui" },
  { key: "stayed", color: "bg-gray-400", label: "Pysyi" },
  { key: "out", color: "bg-red-500", label: "Palanut" },
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
}: {
  rows: DistributionRow[];
  totalEvents: number;
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
              <div key={r.player_id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{r.full_name}</span>
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
          <CardTitle>Lukumäärät</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2">Pelaaja</th>
                  <th className="pb-2 text-right">Otos</th>
                  <th className="pb-2 text-right">Juoksu</th>
                  <th className="pb-2 text-right">3b</th>
                  <th className="pb-2 text-right">2b</th>
                  <th className="pb-2 text-right">1b</th>
                  <th className="pb-2 text-right">Haav.</th>
                  <th className="pb-2 text-right">Pysyi</th>
                  <th className="pb-2 text-right">Palo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.player_id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{r.full_name}</td>
                    <td className="py-2 text-right tabular-nums">{r.total}</td>
                    <td className="py-2 text-right tabular-nums">{r.scored}</td>
                    <td className="py-2 text-right tabular-nums">{r.reached_3b}</td>
                    <td className="py-2 text-right tabular-nums">{r.reached_2b}</td>
                    <td className="py-2 text-right tabular-nums">{r.reached_1b}</td>
                    <td className="py-2 text-right tabular-nums">{r.wounded}</td>
                    <td className="py-2 text-right tabular-nums">{r.stayed}</td>
                    <td className="py-2 text-right tabular-nums">{r.out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
