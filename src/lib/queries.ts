import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Supabase PostgREST rajoittaa oletuksena palautuksen 1000 riviin riippumatta
// .limit()-arvosta. Tämä helpperi sivuttaa kyselyn .range()-kutsuilla.
async function fetchAllPaged<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ============================================================================
// Series / seasons / groups
// ============================================================================

export type SeriesOption = {
  series_name: string; // e.g. "Miesten Superpesis"
  years: { year: number; season_id: number; season_series_id: number }[];
};

/** Lista uniikeista sarjoista (series.name), joilla on joukkueita join'in kautta. */
export const seriesListQueryOptions = queryOptions({
  queryKey: ["series-list"],
  queryFn: async (): Promise<SeriesOption[]> => {
    const pageSize = 1000;
    let from = 0;
    const data: any[] = [];
    while (true) {
      const { data: page, error } = await supabase
        .from("series")
        .select("name, season_series_id, season_id, seasons(year)")
        .order("name")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!page || page.length === 0) break;
      data.push(...page);
      if (page.length < pageSize) break;
      from += pageSize;
    }


    const map = new Map<string, SeriesOption>();
    for (const row of data ?? []) {
      const year = (row as any).seasons?.year as number | undefined;
      if (!year) continue;
      const name = row.name;
      if (!map.has(name)) map.set(name, { series_name: name, years: [] });
      map.get(name)!.years.push({
        year,
        season_id: row.season_id,
        season_series_id: row.season_series_id,
      });
    }
    const list = Array.from(map.values());
    list.forEach((s) => s.years.sort((a, b) => b.year - a.year));
    list.sort((a, b) => a.series_name.localeCompare(b.series_name, "fi"));
    return list;
  },
  staleTime: 5 * 60 * 1000,
});

/** Varmistaa että kauden sarja on synkronoitu Supabaseen. Jos team_in_series_group on tyhjä,
 *  selvittää oikean phase_id:n series_groups-taulusta ja kutsuu sync-result-board edge functionia. */
export const ensureSeasonSeriesSyncedQueryOptions = (season_series_id: number) =>
  queryOptions({
    queryKey: ["ensure-season-series-synced", season_series_id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("team_in_series_group")
        .select("*", { count: "exact", head: true })
        .eq("season_series_id", season_series_id);
      if (error) throw error;

      if ((count ?? 0) === 0) {
        const { data: phases, error: phaseError } = await supabase
          .from("series_groups")
          .select("phase_id")
          .eq("season_series_id", season_series_id)
          .eq("is_playoff", false)
          .limit(1);

        if (phaseError) throw phaseError;

        const phase = phases?.[0]?.phase_id ?? 1;

        const { error: fnError } = await supabase.functions.invoke("sync-result-board", {
          body: { season_series_id, phase },
        });
        if (fnError) throw fnError;
      }
      return { season_series_id, synced: true };
    },
    staleTime: 5 * 60 * 1000,
  });

export const groupsForSeasonSeriesQueryOptions = (season_series_id: number) =>
  queryOptions({
    queryKey: ["series-groups", season_series_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_groups")
        .select("group_id, name, is_playoff, season_series_id")
        .eq("season_series_id", season_series_id)
        .order("is_playoff")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

export const teamsInGroupQueryOptions = (group_id: number) =>
  queryOptions({
    queryKey: ["teams-in-group", group_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_in_series_group")
        .select("team_id, teams(team_id, name, logo_url, shorthand, sport_club_id, last_player_sync)")
        .eq("group_id", group_id);
      if (error) throw error;
      return (data ?? [])
        .map((r) => (r as any).teams)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "fi"));
    },
    staleTime: 60 * 1000,
  });

// ============================================================================
// Team page data
// ============================================================================

export const teamQueryOptions = (team_id: number) =>
  queryOptions({
    queryKey: ["team", team_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("team_id", team_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

export const teamRosterQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["team-roster", team_id, season_series_id],
    queryFn: async () => {
      const [atBatData, pitchData] = await Promise.all([
        fetchAllPaged<{ player_id: number | null }>((from, to) =>
          supabase
            .from("v_at_bat_participants_with_goals")
            .select("player_id")
            .eq("team_id", team_id)
            .eq("season_series_id", season_series_id)
            .range(from, to),
        ),
        fetchAllPaged<{ player_id: number | null }>((from, to) =>
          supabase
            .from("v_pitch_participants_with_goals")
            .select("player_id")
            .eq("team_id", team_id)
            .eq("season_series_id", season_series_id)
            .range(from, to),
        ),
      ]);

      const playerIds = Array.from(
        new Set(
          [...atBatData, ...pitchData]
            .map((row) => row.player_id)
            .filter((playerId): playerId is number => typeof playerId === "number"),
        ),
      );

      if (playerIds.length === 0) return [];

      const players = await fetchAllPaged<{ player_id: number; full_name: string | null; image_url: string | null }>(
        (from, to) =>
          supabase
            .from("players")
            .select("player_id, full_name, image_url")
            .in("player_id", playerIds)
            .range(from, to),
      );

      return players
        .filter((player) => (player.full_name ?? "").trim().length > 0)
        .sort((a, b) => a.full_name!.localeCompare(b.full_name!, "fi"));
    },
    staleTime: 60 * 1000,
  });

export const teamMatchesQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["team-matches", team_id, season_series_id],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("matches")
          .select("*, home:teams!matches_home_team_id_fkey(team_id, name, shorthand), away:teams!matches_away_team_id_fkey(team_id, name, shorthand)")
          .eq("season_series_id", season_series_id)
          .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
          .order("match_date", { ascending: false })
          .range(from, to),
      );
    },

    staleTime: 30 * 1000,
  });

// ============================================================================
// Stats — vuorotason (at_bat) ja lyöntitason (pitch)
// ============================================================================

export const atBatParticipantsQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["v-at-bat", team_id, season_series_id],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("v_at_bat_participants_with_goals")
          .select(
            "match_id, period, inning, bat_turn, at_bat_in_inning, team_id, player_id, batter_id, role_at_start, start_base, end_base, effective_start_runner_1b, effective_start_runner_2b, effective_start_runner_3b, had_hit_advance, had_error_advance, had_steal, had_walk, got_out, got_wounded, goal_lead_advance, goal_tail_advance_runner, goal_tail_advance_batter, goal_no_outs, players!at_bat_participants_player_id_fkey(full_name)"
          )
          .eq("team_id", team_id)
          .eq("season_series_id", season_series_id)
          .range(from, to),
      );
    },
    staleTime: 30 * 1000,
  });

export const pitchParticipantsQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["v-pitch", team_id, season_series_id],
    queryFn: async () => {
      return await fetchAllPaged<any>((from, to) =>
        supabase
          .from("v_pitch_participants_with_goals")
          .select(
            "match_id, period, inning, bat_turn, at_bat_in_inning, hit_number, team_id, player_id, batter_id, role_at_start, start_base, end_base, start_runner_1b, start_runner_2b, start_runner_3b, had_hit_advance, got_out, got_wounded, goal_lead_advance, goal_tail_advance_runner, goal_tail_advance_batter, goal_no_outs, players!pitch_participants_player_id_fkey(full_name)"
          )
          .eq("team_id", team_id)
          .eq("season_series_id", season_series_id)
          .range(from, to),
      );
    },
    staleTime: 30 * 1000,
  });

// ============================================================================
// Pitch points — heatmap-pisteet kentälle
// ============================================================================

export type PitchPoint = {
  match_id: number;
  period: number;
  inning: number;
  bat_turn: number;
  at_bat_in_inning: number;
  hit_number: number;
  batter_id: number | null;
  x: number;
  y: number;
  outcome_color: "red" | "yellow" | "green" | "gray";
  start_runner_1b: number | null;
  start_runner_2b: number | null;
  start_runner_3b: number | null;
};

export const pitchPointsQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["pitch-points", team_id, season_series_id],
    queryFn: async (): Promise<PitchPoint[]> => {
      const data = await fetchAllPaged<any>((from, to) =>
        supabase
          .from("v_pitches_with_outcome_color")
          .select(
            "match_id, period, inning, bat_turn, at_bat_in_inning, hit_number, batter_id, x, y, outcome_color, start_runner_1b, start_runner_2b, start_runner_3b"
          )
          .eq("team_id", team_id)
          .eq("season_series_id", season_series_id)
          .range(from, to),
      );
      return data.filter(
        (r) =>
          r.match_id != null &&
          r.x != null &&
          r.y != null &&
          r.outcome_color != null,
      ) as PitchPoint[];
    },
    staleTime: 60 * 1000,
  });

