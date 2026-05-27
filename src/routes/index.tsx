import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { seriesListQueryOptions, groupsForSeasonSeriesQueryOptions, teamsInGroupQueryOptions } from "@/lib/queries";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pesistilastot — pelaajien onnistumiset eri tilanteissa" },
      { name: "description", content: "Selaa pesäpalloilijoiden onnistumistilastoja pesätilanteen, lyöntinumeron ja tavoitteen mukaan." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seriesListQueryOptions),
  component: Index,
});

function Index() {
  const { data: seriesList } = useSuspenseQuery(seriesListQueryOptions);
  const [seriesName, setSeriesName] = useState<string>("");
  const [seasonSeriesId, setSeasonSeriesId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);

  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.series_name === seriesName) ?? null,
    [seriesList, seriesName],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">Pesistilastot</h1>
          <p className="text-sm text-muted-foreground">Pelaajien onnistumiset eri pelitilanteissa</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <Card>
          <CardContent className="grid gap-4 p-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sarja</label>
              <Select
                value={seriesName}
                onValueChange={(v) => {
                  setSeriesName(v);
                  setSeasonSeriesId(null);
                  setGroupId(null);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Valitse sarja" /></SelectTrigger>
                <SelectContent>
                  {seriesList.map((s) => (
                    <SelectItem key={s.series_name} value={s.series_name}>{s.series_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Kausi</label>
              <Select
                value={seasonSeriesId ? String(seasonSeriesId) : ""}
                onValueChange={(v) => { setSeasonSeriesId(Number(v)); setGroupId(null); }}
                disabled={!selectedSeries}
              >
                <SelectTrigger><SelectValue placeholder="Valitse kausi" /></SelectTrigger>
                <SelectContent>
                  {selectedSeries?.years.map((y) => (
                    <SelectItem key={y.season_series_id} value={String(y.season_series_id)}>{y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Lohko</label>
              <GroupSelect
                seasonSeriesId={seasonSeriesId}
                groupId={groupId}
                onChange={setGroupId}
              />
            </div>
          </CardContent>
        </Card>

        {groupId && seasonSeriesId && (
          <TeamGrid groupId={groupId} seasonSeriesId={seasonSeriesId} />
        )}
      </main>
    </div>
  );
}

function GroupSelect({ seasonSeriesId, groupId, onChange }: {
  seasonSeriesId: number | null;
  groupId: number | null;
  onChange: (id: number) => void;
}) {
  const { data: groups } = useQuery({
    ...groupsForSeasonSeriesQueryOptions(seasonSeriesId ?? 0),
    enabled: !!seasonSeriesId,
  });

  // Auto-valitse jos vain yksi
  if (groups && groups.length === 1 && groupId !== groups[0].group_id) {
    onChange(groups[0].group_id);
  }

  return (
    <Select
      value={groupId ? String(groupId) : ""}
      onValueChange={(v) => onChange(Number(v))}
      disabled={!seasonSeriesId || !groups || groups.length === 0}
    >
      <SelectTrigger><SelectValue placeholder={groups?.length === 0 ? "Ei lohkoja" : "Valitse lohko"} /></SelectTrigger>
      <SelectContent>
        {groups?.map((g) => (
          <SelectItem key={g.group_id} value={String(g.group_id)}>
            {g.name}{g.is_playoff ? " (pudotuspelit)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TeamGrid({ groupId, seasonSeriesId }: { groupId: number; seasonSeriesId: number }) {
  const { data: teams, isLoading } = useQuery(teamsInGroupQueryOptions(groupId));

  if (isLoading) return <p className="text-sm text-muted-foreground">Ladataan joukkueita…</p>;
  if (!teams || teams.length === 0) return <p className="text-sm text-muted-foreground">Lohkossa ei ole joukkueita.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {teams.map((t: any) => (
        <Link
          key={t.team_id}
          to="/team/$teamId"
          params={{ teamId: String(t.team_id) }}
          search={{ seasonSeriesId, groupId }}
          className="group"
        >
          <Card className="transition-all hover:border-primary hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              {t.logo_url ? (
                <img src={t.logo_url} alt="" className="h-12 w-12 rounded-md object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-xs font-bold">
                  {t.shorthand ?? "?"}
                </div>
              )}
              <span className="font-medium group-hover:text-primary">{t.name}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
