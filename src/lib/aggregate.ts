import { parseSlot, hasMeasured, type TeamFilters } from "./filters";

type AtBatRow = {
  team_id: number | null;
  player_id: number | null;
  role_at_start: string | null;
  start_base: number | null;
  effective_start_runner_1b: number | null;
  effective_start_runner_2b: number | null;
  effective_start_runner_3b: number | null;
  goal_lead_advance: string | null;
  goal_tail_advance_runner: string | null;
  goal_tail_advance_batter: string | null;
  players: { full_name: string | null } | null;
};

type PitchRow = AtBatRow & {
  hit_number: number | null;
  start_runner_1b: number | null;
  start_runner_2b: number | null;
  start_runner_3b: number | null;
  goal_no_outs: string | null;
};

type Aggregated = Record<number, { full_name: string; successes: number; attempts: number }>;

function matchesRunnerFilter(
  filters: TeamFilters,
  r1: number | null,
  r2: number | null,
  r3: number | null,
) {
  const slots: [number, string][] = [
    [1, filters.runner1],
    [2, filters.runner2],
    [3, filters.runner3],
  ];
  for (const [base, slot] of slots) {
    const parsed = parseSlot(slot);
    const actual = base === 1 ? r1 : base === 2 ? r2 : r3;
    if (parsed.kind === "none") {
      if (actual !== null) return false;
    } else if (parsed.kind === "player") {
      if (actual !== parsed.id) return false;
    }
    // "measured" → rajataan myöhemmin player_id:llä
  }
  return true;
}

function goalValue(
  r: { goal_lead_advance: string | null; goal_tail_advance_runner: string | null; goal_tail_advance_batter: string | null; goal_no_outs?: string | null; start_base: number | null },
  filters: TeamFilters,
): string | null {
  if (filters.goal === "tail_advance") {
    return r.start_base === 0 ? r.goal_tail_advance_batter : r.goal_tail_advance_runner;
  }
  if (filters.goal === "lead_advance") return r.goal_lead_advance;
  if (filters.goal === "no_outs") return r.goal_no_outs ?? null;
  return null;
}

export function aggregateAtBatStats(rows: AtBatRow[], filters: TeamFilters) {
  const measuredBase = hasMeasured(filters);
  const agg: Aggregated = {};

  for (const r of rows) {
    if (!matchesRunnerFilter(filters, r.effective_start_runner_1b, r.effective_start_runner_2b, r.effective_start_runner_3b)) continue;
    if (measuredBase !== null && r.start_base !== measuredBase) continue;
    if (!r.player_id) continue;

    const value = goalValue(r, filters);
    if (value !== "success" && value !== "failure") continue;

    const id = r.player_id;
    if (!agg[id]) agg[id] = { full_name: r.players?.full_name ?? `#${id}`, successes: 0, attempts: 0 };
    agg[id].attempts += 1;
    if (value === "success") agg[id].successes += 1;
  }

  return Object.entries(agg).map(([id, v]) => ({ player_id: Number(id), ...v }));
}

export function aggregatePitchStats(rows: PitchRow[], filters: TeamFilters) {
  const measuredBase = hasMeasured(filters);
  const agg: Aggregated = {};
  const hitNum = filters.hitNumber;

  for (const r of rows) {
    if (!matchesRunnerFilter(filters, r.start_runner_1b, r.start_runner_2b, r.start_runner_3b)) continue;
    if (measuredBase !== null && r.start_base !== measuredBase) continue;
    if (!r.player_id) continue;

    if (hitNum === "1" || hitNum === "2" || hitNum === "3") {
      if (r.hit_number !== Number(hitNum)) continue;
    }

    const value = goalValue(r, filters);
    if (value !== "success" && value !== "failure") continue;

    const id = r.player_id;
    if (!agg[id]) agg[id] = { full_name: r.players?.full_name ?? `#${id}`, successes: 0, attempts: 0 };
    agg[id].attempts += 1;
    if (value === "success") agg[id].successes += 1;
  }

  return Object.entries(agg).map(([id, v]) => ({ player_id: Number(id), ...v }));
}
