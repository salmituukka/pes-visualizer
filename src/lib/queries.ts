import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase
      .from("series")
      .select("name, season_series_id, season_id, seasons(year)")
      .order("name");
    if (error) throw error;

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
      // Pelaajat jotka ovat osallistuneet ko. joukkueessa ko. kaudella (at_bat tai pitch)
      const { data, error } = await supabase
        .from("v_at_bat_participants_with_goals")
        .select("player_id, players(player_id, full_name, image_url)")
        .eq("team_id", team_id)
        .eq("season_series_id", season_series_id)
        .limit(10000);
      if (error) throw error;
      const seen = new Map<number, { player_id: number; full_name: string | null; image_url: string | null }>();
      for (const row of data ?? []) {
        const p: any = (row as any).players;
        if (p && p.player_id && !seen.has(p.player_id)) {
          seen.set(p.player_id, { player_id: p.player_id, full_name: p.full_name, image_url: p.image_url });
        }
      }
      return Array.from(seen.values()).sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "", "fi"),
      );
    },
    staleTime: 60 * 1000,
  });

export const teamMatchesQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["team-matches", team_id, season_series_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("season_series_id", season_series_id)
        .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
        .order("match_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
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
      const { data, error } = await supabase
        .from("v_at_bat_participants_with_goals")
        .select(
          "match_id, period, inning, bat_turn, at_bat_in_inning, team_id, player_id, batter_id, role_at_start, start_base, end_base, effective_start_runner_1b, effective_start_runner_2b, effective_start_runner_3b, goal_lead_advance, goal_tail_advance_runner, goal_tail_advance_batter, players(full_name)"
        )
        .eq("team_id", team_id)
        .eq("season_series_id", season_series_id)
        .limit(50000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 1000,
  });

export const pitchParticipantsQueryOptions = (team_id: number, season_series_id: number) =>
  queryOptions({
    queryKey: ["v-pitch", team_id, season_series_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_pitch_participants_with_goals")
        .select(
          "match_id, period, inning, bat_turn, at_bat_in_inning, hit_number, team_id, player_id, batter_id, role_at_start, start_base, end_base, start_runner_1b, start_runner_2b, start_runner_3b, goal_lead_advance, goal_tail_advance_runner, goal_tail_advance_batter, goal_no_outs, players(full_name)"
        )
        .eq("team_id", team_id)
        .eq("season_series_id", season_series_id)
        .limit(100000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30 * 1000,
  });
