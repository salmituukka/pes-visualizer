import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeamFilters } from "@/lib/filters";

type Row = {
  player_id: number;
  full_name: string;
  successes: number;
  attempts: number;
};

export function StatsDisplay({
  rows,
  filters,
  totalEvents,
}: {
  rows: Row[];
  filters: TeamFilters;
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
            Valituilla suodattimilla ei löytynyt tilannetta otteluista. Kokeile muuttaa pesätilannetta tai
            tavoitetta. (Otteluita käsitelty: {totalEvents})
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const aPct = a.attempts > 0 ? a.successes / a.attempts : 0;
    const bPct = b.attempts > 0 ? b.successes / b.attempts : 0;
    if (bPct !== aPct) return bPct - aPct;
    return b.attempts - a.attempts;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labelForGoal(filters.goal)}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2">Pelaaja</th>
              <th className="pb-2 text-right">Onnistui</th>
              <th className="pb-2 text-right">Yritti</th>
              <th className="pb-2 text-right">%</th>
              <th className="pb-2 pl-4 w-40">Onnistumis-%</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const pct = r.attempts > 0 ? (r.successes / r.attempts) * 100 : 0;
              return (
                <tr key={r.player_id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{r.full_name}</td>
                  <td className="py-2 text-right">{r.successes}</td>
                  <td className="py-2 text-right">{r.attempts}</td>
                  <td className="py-2 text-right tabular-nums">{pct.toFixed(0)}%</td>
                  <td className="py-2 pl-4">
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function labelForGoal(goal: TeamFilters["goal"]) {
  switch (goal) {
    case "lead_advance":
      return "Kärkisiirtymän onnistuminen";
    case "tail_advance":
      return "Takasiirtymän onnistuminen";
    case "no_outs":
      return "Ei paloja";
    default:
      return "Tilastot";
  }
}
