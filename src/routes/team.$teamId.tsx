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
  opponentAtBatParticipantsQueryOptions,
  opponentPitchParticipantsQueryOptions,
} from "@/lib/queries";
import { ensurePlayerSync, parsePendingMatches, needsReparsing } from "@/lib/match-sync";
import { RefreshMatchButton } from "@/components/refresh-match-button";
import { useQueryClient } from "@tanstack/react-query";
import { BaseFieldPicker, type SlotKey } from "@/components/base-field-picker";
import { StatsDisplay } from "@/components/stats-display";
import { DistributionDisplay } from "@/components/distribution-display";
import { aggregateAtBatStats, aggregatePitchStats, aggregateDistribution, aggregateExpectedValues } from "@/lib/aggregate";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { hasMeasured, parseSlot, type TeamFilters } from "@/lib/filters";

const searchSchema = z.object({
  seasonSeriesId: fallback(z.coerce.number(), 0).default(0),
  groupId: fallback(z.coerce.number().optional(), undefined),
  runner1: fallback(z.string(), "any_or_none").default("any_or_none"),
  runner2: fallback(z.string(), "any_or_none").default("any_or_none"),
  runner3: fallback(z.string(), "any_or_none").default("any_or_none"),
  batter: fallback(z.string(), "any").default("any"),
  hitNumber: fallback(z.enum(["1", "2", "3", "any-single", "turn"]), "turn").default("turn"),
  goal: fallback(z.enum(["lead_advance", "tail_advance", "no_outs"]), "lead_advance").default("lead_advance"),
  matchId: z.coerce.number().optional().catch(undefined),
  mode: fallback(z.enum(["offense", "defense"]), "offense").default("offense"),
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

/** Ulkopelissä pelaaja-valinnat ja "Mitattava" käsitellään aina any/any_or_none:na. */
function sanitizeForDefense(f: TeamFilters): TeamFilters {
  const fixRunner = (v: string) => {
    const p = parseSlot(v);
    if (p.kind === "player" || p.kind === "measured") return "any_or_none";
    return v;
  };
  const fixBatter = (v: string) => {
    const p = parseSlot(v);
    if (p.kind === "player" || p.kind === "measured") return "any";
    return v;
  };
  return {
    ...f,
    runner1: fixRunner(f.runner1),
    runner2: fixRunner(f.runner2),
    runner3: fixRunner(f.runner3),
    batter: fixBatter(f.batter),
  };
}

function TeamPage() {
  const { teamId } = Route.useParams();
  const search = Route.useSearch();
  const teamIdNum = Number(teamId);
  const seasonSeriesId = search.seasonSeriesId;
  const navigate = useNavigate({ from: Route.fullPath });
  const isDefense = search.mode === "defense";

  const { data: team } = useSuspenseQuery(teamQueryOptions(teamIdNum));
  const { data: matches } = useQuery({
    ...teamMatchesQueryOptions(teamIdNum, seasonSeriesId),
    enabled: seasonSeriesId > 0,
  });
  const { data: roster } = useQuery({
    ...teamRosterQueryOptions(teamIdNum, seasonSeriesId),
    enabled: seasonSeriesId > 0 && !isDefense,
  });

  const opponentMatchIds = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m: any) => m.events_fetched_at)
      .map((m: any) => m.match_id as number);
  }, [matches]);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Ensikäynnistys: sync players + fetch missing match events
  useEffect(() => {
    if (!matches || seasonSeriesId <= 0 || syncing) return;
    const pending = matches.filter((m: any) => !m.events_fetched_at || needsReparsing(m));
    if (pending.length === 0 && team?.last_player_sync) return;

    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        await ensurePlayerSync(teamIdNum, seasonSeriesId, team?.last_player_sync ?? null);
        if (cancelled) return;
        await parsePendingMatches(matches as any, (p) => !cancelled && setProgress(p));
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["v-at-bat", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["v-pitch", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["opp-v-at-bat", teamIdNum, seasonSeriesId] });
        queryClient.invalidateQueries({ queryKey: ["opp-v-pitch", teamIdNum, seasonSeriesId] });
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

  const setMode = (m: "offense" | "defense") => {
    if (!m || m === search.mode) return;
    navigate({
      search: (prev: any) => {
        const next = { ...prev, mode: m };
        if (m === "defense") {
          const sanitized = sanitizeForDefense(prev as TeamFilters);
          next.runner1 = sanitized.runner1;
          next.runner2 = sanitized.runner2;
          next.runner3 = sanitized.runner3;
          next.batter = sanitized.batter;
        }
        return next;
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 space-y-2">
          <nav className="text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Etusivu</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground">{team.name}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            {team.logo_url && <img src={team.logo_url} alt="" className="h-10 w-10 rounded-md object-contain" />}
            <h1 className="text-2xl font-bold">
              {team.name} – {isDefense ? "Ulkopeli" : "Sisäpeli"}
            </h1>
            <ToggleGroup
              type="single"
              value={search.mode}
              onValueChange={(v) => setMode(v as "offense" | "defense")}
              variant="outline"
              size="sm"
              className="ml-auto"
            >
              <ToggleGroupItem value="offense" aria-label="Sisäpeli">Sisäpeli</ToggleGroupItem>
              <ToggleGroupItem value="defense" aria-label="Ulkopeli">Ulkopeli</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <FilterPanel
            roster={roster ?? []}
            teamId={teamIdNum}
            seasonSeriesId={seasonSeriesId}
            isDefense={isDefense}
            opponentMatchIds={opponentMatchIds}
          />
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
          <StatsSection
            teamId={teamIdNum}
            seasonSeriesId={seasonSeriesId}
            isDefense={isDefense}
            opponentMatchIds={opponentMatchIds}
          />
        </section>
      </main>
    </div>
  );
}

function FilterPanel({
  roster,
  teamId,
  seasonSeriesId,
  isDefense,
  opponentMatchIds,
}: {
  roster: { player_id: number; full_name: string | null }[];
  teamId: number;
  seasonSeriesId: number;
  isDefense: boolean;
  opponentMatchIds: number[];
}) {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data: matches } = useQuery({
    ...teamMatchesQueryOptions(teamId, seasonSeriesId),
    enabled: seasonSeriesId > 0,
  });

  const setSlot = (slot: SlotKey, value: string) => {
    navigate({
      search: (prev: any) => ({ ...prev, [slot]: value }),
    });
  };

  const measured = hasMeasured(search as TeamFilters);

  const matchOptions = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m: any) => m.events_fetched_at)
      .map((m: any) => {
        const isHome = m.home_team_id === teamId;
        const opp = isHome ? m.away : m.home;
        const oppName = opp?.shorthand || opp?.name || "?";
        const d = m.match_date ? new Date(m.match_date) : null;
        const dateStr = d
          ? `${d.getDate()}.${d.getMonth() + 1}.`
          : "";
        return { match_id: m.match_id as number, label: `${oppName} ${dateStr}`.trim() };
      });
  }, [matches, teamId]);

  // Ulkopelissä mitattavaa ei voi olla → näytetään vain peruskortit ilman Tavoite-korttia
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
            matchId={search.matchId}
            disablePlayers={isDefense}
            opponentMatchIds={opponentMatchIds}
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Ottelu</h3>
          <Select
            value={search.matchId ? String(search.matchId) : "all"}
            onValueChange={(v) =>
              navigate({ search: (p: any) => ({ ...p, matchId: v === "all" ? undefined : Number(v) }) })
            }
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Kaikki ottelut</SelectItem>
              {matchOptions.map((m) => (
                <SelectItem key={m.match_id} value={String(m.match_id)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {search.matchId && (() => {
            const selected = matches?.find((m: any) => m.match_id === search.matchId);
            if (!selected) return null;
            return (
              <RefreshMatchButton
                matchId={search.matchId}
                matchDate={selected.match_date ?? null}
                teamId={teamId}
                seasonSeriesId={seasonSeriesId}
              />
            );
          })()}
        </CardContent>
      </Card>

      {!isDefense && (
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
      )}
    </>
  );
}

function StatsSection({
  teamId,
  seasonSeriesId,
  isDefense,
  opponentMatchIds,
}: {
  teamId: number;
  seasonSeriesId: number;
  isDefense: boolean;
  opponentMatchIds: number[];
}) {
  const rawSearch = Route.useSearch() as TeamFilters;
  // Ulkopelissä pakotetaan pelaaja/measured pois suodattimista myös aggregoinnissa
  const search = isDefense ? sanitizeForDefense(rawSearch) : rawSearch;
  const usePitch = search.hitNumber !== "turn";

  const offenseAtBat = useQuery({
    ...atBatParticipantsQueryOptions(teamId, seasonSeriesId),
    enabled: !isDefense && !usePitch && seasonSeriesId > 0,
  });
  const offensePitch = useQuery({
    ...pitchParticipantsQueryOptions(teamId, seasonSeriesId),
    enabled: !isDefense && usePitch && seasonSeriesId > 0,
  });
  const defenseAtBat = useQuery({
    ...opponentAtBatParticipantsQueryOptions(teamId, seasonSeriesId, opponentMatchIds),
    enabled: isDefense && !usePitch && seasonSeriesId > 0 && opponentMatchIds.length > 0,
  });
  const defensePitch = useQuery({
    ...opponentPitchParticipantsQueryOptions(teamId, seasonSeriesId, opponentMatchIds),
    enabled: isDefense && usePitch && seasonSeriesId > 0 && opponentMatchIds.length > 0,
  });

  const atBatRows = isDefense ? defenseAtBat.data : offenseAtBat.data;
  const pitchRows = isDefense ? defensePitch.data : offensePitch.data;
  const loading =
    (usePitch
      ? (isDefense ? defensePitch.isLoading : offensePitch.isLoading)
      : (isDefense ? defenseAtBat.isLoading : offenseAtBat.isLoading));

  const filteredAtBatRows = useMemo(
    () => (search.matchId ? (atBatRows ?? []).filter((r: any) => r.match_id === search.matchId) : atBatRows),
    [atBatRows, search.matchId],
  );
  const filteredPitchRows = useMemo(
    () => (search.matchId ? (pitchRows ?? []).filter((r: any) => r.match_id === search.matchId) : pitchRows),
    [pitchRows, search.matchId],
  );

  // Ulkopelissä measured aina null
  const measured = isDefense ? null : hasMeasured(search);
  const totalEvents = (filteredAtBatRows?.length ?? 0) + (filteredPitchRows?.length ?? 0);

  const rankingRows = useMemo(() => {
    if (measured === null) return [];
    if (usePitch) return filteredPitchRows ? aggregatePitchStats(filteredPitchRows as any, search) : [];
    return filteredAtBatRows ? aggregateAtBatStats(filteredAtBatRows as any, search) : [];
  }, [measured, usePitch, filteredAtBatRows, filteredPitchRows, search]);

  const distributionRows = useMemo(() => {
    if (measured !== null) return [];
    if (usePitch) return filteredPitchRows ? aggregateDistribution(filteredPitchRows as any, search, "pitch") : [];
    return filteredAtBatRows ? aggregateDistribution(filteredAtBatRows as any, search, "at_bat") : [];
  }, [measured, usePitch, filteredAtBatRows, filteredPitchRows, search]);

  const expected = useMemo(() => {
    if (measured !== null) return { n: 0, runs: 0, leadAdvance: 0, tailAdvance: 0, wounded: 0, leadOuts: 0, tailOuts: 0 };
    if (usePitch) return aggregateExpectedValues((filteredPitchRows ?? []) as any, search, "pitch");
    return aggregateExpectedValues((filteredAtBatRows ?? []) as any, search, "at_bat");
  }, [measured, usePitch, filteredAtBatRows, filteredPitchRows, search]);

  if (loading) return <p className="text-sm text-muted-foreground">Lasketaan tilastoja…</p>;

  if (measured !== null) {
    return <StatsDisplay rows={rankingRows} filters={search} totalEvents={totalEvents} />;
  }
  return (
    <DistributionDisplay
      rows={distributionRows}
      totalEvents={totalEvents}
      expected={expected}
      level={usePitch ? "pitch" : "at_bat"}
    />
  );
}
