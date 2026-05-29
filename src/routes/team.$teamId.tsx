import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  teamQueryOptions,
  teamRosterQueryOptions,
  teamMatchesQueryOptions,
  atBatParticipantsQueryOptions,
  pitchParticipantsQueryOptions,
} from "@/lib/queries";
import { ensurePlayerSync, parseMissingMatches } from "@/lib/match-sync";
import { useQueryClient } from "@tanstack/react-query";
import { BaseFieldPicker, type SlotKey } from "@/components/base-field-picker";
import { StatsDisplay } from "@/components/stats-display";
import { DistributionDisplay } from "@/components/distribution-display";
import { aggregateAtBatStats, aggregatePitchStats, aggregateDistribution } from "@/lib/aggregate";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasMeasured, type TeamFilters } from "@/lib/filters";

const searchSchema = z.object({
  seasonSeriesId: fallback(z.coerce.number(), 0).default(0),
  groupId: fallback(z.coerce.number().optional(), undefined),
  runner1: fallback(z.string(), "any").default("any"),
  runner2: fallback(z.string(), "any").default("any"),
  runner3: fallback(z.string(), "any").default("any"),
  batter: fallback(z.string(), "any").default("any"),
  hitNumber: fallback(z.enum(["1", "2", "3", "any-single", "turn"]), "turn").default("turn"),
  goal: fallback(z.enum(["lead_advance", "tail_advance", "no_outs"]), "lead_advance").default("lead_advance"),
});

export const Route = createFileRoute("/team/$teamId")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Joukkueen tilastot — Pesistilastot" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { teamId } = Route.useParams();
  const search = Route.useSearch();
  const teamIdNum = Number(teamId);
  const seasonSeriesId = search.seasonSeriesId;

  const { data: team } = useSuspenseQuery(teamQueryOptions(teamIdNum));
  const { data: matches } = useQuery({
    ...teamMatchesQueryOptions(teamIdNum, seasonSeriesId),
    enabled: seasonSeriesId > 0,
  });
  const { data: roster } = useQuery({
    ...teamRosterQueryOptions(teamIdNum, seasonSeriesId),
    enabled: seasonSeriesId > 0,
  });

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Ensikäynnistys: sync players + fetch missing match events
  useEffect(() => {
    if (!matches || seasonSeriesId <= 0 || syncing) return;
    const missing = matches.filter((m) => !m.events_fetched_at);
    if (missing.length === 0 && team?.last_player_sync) return;

    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        await ensurePlayerSync(teamIdNum, seasonSeriesId, team?.last_player_sync ?? null);
        if (cancelled) return;
        await parseMissingMatches(matches, (p) => !cancelled && setProgress(p));
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["v-at-bat", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["v-pitch", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["team-roster", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["team-matches", teamIdNum, seasonSeriesId] });
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setProgress(null);
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches?.length, seasonSeriesId, teamIdNum]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 space-y-2">
          <nav className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Etusivu</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{team.name}</span>
          </nav>
          <div className="flex items-center gap-3">
            {team.logo_url && <img src={team.logo_url} alt="" className="h-10 w-10 rounded-md object-contain" />}
            <h1 className="text-2xl font-bold">{team.name}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <FilterPanel roster={roster ?? []} teamId={teamIdNum} seasonSeriesId={seasonSeriesId} />

        </aside>
        <section className="space-y-4">
          {syncing && progress && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-medium">Ladataan otteluita: {progress.done}/{progress.total}</p>
                <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
              </CardContent>
            </Card>
          )}
          <StatsSection teamId={teamIdNum} seasonSeriesId={seasonSeriesId} />
        </section>
      </main>
    </div>
  );
}

function FilterPanel({ roster, teamId, seasonSeriesId }: { roster: { player_id: number; full_name: string | null }[]; teamId: number; seasonSeriesId: number }) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setSlot = (slot: SlotKey, value: string) => {
    navigate({
      search: (prev: any) => ({ ...prev, [slot]: value }),
    });
  };

  const measured = hasMeasured(search as TeamFilters);

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pesätilanne</h3>
          <BaseFieldPicker
            roster={roster}
            values={{
              runner1: search.runner1,
              runner2: search.runner2,
              runner3: search.runner3,
              batter: search.batter,
            }}
            onChange={setSlot}
            teamId={teamId}
            seasonSeriesId={seasonSeriesId}
            hitNumber={search.hitNumber}
          />
        </CardContent>
      </Card>



      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lyöntinumero</h3>
          <RadioGroup
            value={search.hitNumber}
            onValueChange={(v) => navigate({ search: (p: any) => ({ ...p, hitNumber: v }) })}
          >
            {[
              ["turn", "Lyöntivuoro"],
              ["1", "1. lyönti"],
              ["2", "2. lyönti"],
              ["3", "3. lyönti"],
              ["any-single", "Mikä tahansa yksittäinen"],
            ].map(([v, label]) => (
              <div key={v} className="flex items-center space-x-2">
                <RadioGroupItem value={v} id={`hit-${v}`} />
                <Label htmlFor={`hit-${v}`} className="font-normal cursor-pointer">{label}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tavoite</h3>
          {measured === null && (
            <p className="text-xs text-muted-foreground">Aseta "Mitattava" jollekin pesälle nähdäksesi tavoitevaihtoehdot.</p>
          )}
          <Select
            value={search.goal}
            onValueChange={(v) => navigate({ search: (p: any) => ({ ...p, goal: v }) })}
            disabled={measured === null}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lead_advance">Kärkisiirtymä</SelectItem>
              <SelectItem value="tail_advance">Takasiirtymä</SelectItem>
              <SelectItem value="no_outs">Ei paloja</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </>
  );
}

function StatsSection({ teamId, seasonSeriesId }: { teamId: number; seasonSeriesId: number }) {
  const search = Route.useSearch() as TeamFilters;
  const usePitch = search.hitNumber !== "turn";

  const { data: atBatRows, isLoading: a1 } = useQuery({
    ...atBatParticipantsQueryOptions(teamId, seasonSeriesId),
    enabled: !usePitch && seasonSeriesId > 0,
  });
  const { data: pitchRows, isLoading: a2 } = useQuery({
    ...pitchParticipantsQueryOptions(teamId, seasonSeriesId),
    enabled: usePitch && seasonSeriesId > 0,
  });

  const measured = hasMeasured(search);
  const totalEvents = (atBatRows?.length ?? 0) + (pitchRows?.length ?? 0);

  const rankingRows = useMemo(() => {
    if (measured === null) return [];
    if (usePitch) return pitchRows ? aggregatePitchStats(pitchRows as any, search) : [];
    return atBatRows ? aggregateAtBatStats(atBatRows as any, search) : [];
  }, [measured, usePitch, atBatRows, pitchRows, search]);

  const distributionRows = useMemo(() => {
    if (measured !== null) return [];
    if (usePitch) return pitchRows ? aggregateDistribution(pitchRows as any, search, "pitch") : [];
    return atBatRows ? aggregateDistribution(atBatRows as any, search, "at_bat") : [];
  }, [measured, usePitch, atBatRows, pitchRows, search]);

  if (a1 || a2) return <p className="text-sm text-muted-foreground">Lasketaan tilastoja…</p>;

  if (measured !== null) {
    return <StatsDisplay rows={rankingRows} filters={search} totalEvents={totalEvents} />;
  }
  return <DistributionDisplay rows={distributionRows} totalEvents={totalEvents} />;
}
