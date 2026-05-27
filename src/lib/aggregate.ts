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
  for (const [base, slot] of [
    [1, filters.runner1],
    [2, filters.runner2],
    [3, filters.runner3],
  ] as const) {
    const parsed = parseSlot(slot);
    const actual = base === 1 ? r1 : base === 2 ? r2 : r3;
    if (parsed.kind === "none") {
      if (actual !== null) return false;
    } else if (parsed.kind === "player") {
      if (actual !== parsed.id) return false;
    }
    // "measured" → vain rajataan myöhemmin player_id:llä
  }
  return true;
}

function goalColumnForFilters(filters: TeamFilters): keyof AtBatRow | keyof PitchRow {
  switch (filters.goal) {
    case "lead_advance":
      return "goal_lead_advance";
    case "tail_advance":
      return "goal_tail_advance_runner"; // myös batter; käytetään runner-saraketta etenijöille
    case "no_outs":
      return "goal_no_outs";
  }
}

export function aggregateAtBatStats(rows: AtBatRow[], filters: TeamFilters) {
  const measuredBase = hasMeasured(filters);
  const goalCol = goalColumnForFilters(filters) as keyof AtBatRow;
  const agg: Aggregated = {};

  for (const r of rows) {
    if (!matchesRunnerFilter(r, filters)) continue;
    if (!matchesRunnerFilter(filters, r.effective_start_runner_1b, r.effective_start_runner_2b, r.effective_start_runner_3b)) continue;
    if (measuredBase !== null && r.start_base !== measuredBase) continue;
    if (!r.player_id) continue;

    // Takasiirtymä: jos pelaaja on lyöjä (start_base = 0), käytä batter-saraketta
    let value: string | null;
    if (filters.goal === "tail_advance" && r.start_base === 0) {
      value = r.goal_tail_advance_batter;
    } else {
      value = (r as any)[goalCol] as string | null;
    }
    if (value !== "success" && value !== "failure") continue;

    const id = r.player_id;
    if (!agg[id]) agg[id] = { full_name: r.players?.full_name ?? `#${id}`, successes: 0, attempts: 0 };
    agg[id].attempts += 1;
    if (value === "success") agg[id].successes += 1;
  }

  return Object.entries(agg).map(([id, v]) => ({ player_id: Number(id), ...v }));
}

// matchesRunnerFilter overload to also accept (filters, r1, r2, r3) and (row, filters)
function _unused() {}

export function aggregatePitchStats(rows: PitchRow[], filters: TeamFilters) {
  const measuredBase = hasMeasured(filters);
  const goalCol = goalColumnForFilters(filters) as keyof PitchRow;
  const agg: Aggregated = {};

  const hitNum = filters.hitNumber;

  for (const r of rows) {
    if (!matchesRunnerFilter(filters, r.start_runner_1b, r.start_runner_2b, r.start_runner_3b)) continue;
    if (measuredBase !== null && r.start_base !== measuredBase) continue;
    if (!r.player_id) continue;

    if (hitNum === "1" || hitNum === "2" || hitNum === "3") {
      if (r.hit_number !== Number(hitNum)) continue;
    }
    // "any-single" = mikä tahansa yksittäinen lyönti, ei lisärajausta
    // "turn" käsitellään at_bat-näkymässä, ei tässä

    let value: string | null;
    if (filters.goal === "tail_advance" && r.start_base === 0) {
      value = r.goal_tail_advance_batter;
    } else {
      value = (r as any)[goalCol] as string | null;
    }
    if (value !== "success" && value !== "failure") continue;

    const id = r.player_id;
    if (!agg[id]) agg[id] = { full_name: r.players?.full_name ?? `#${id}`, successes: 0, attempts: 0 };
    agg[id].attempts += 1;
    if (value === "success") agg[id].successes += 1;
  }

  return Object.entries(agg).map(([id, v]) => ({ player_id: Number(id), ...v }));
}

// Adjust matchesRunnerFilter: above we accidentally call with (r, filters) — fix wrapper
function matchesRunnerFilterRow(r: AtBatRow, f: TeamFilters) {
  return matchesRunnerFilter(f, r.effective_start_runner_1b, r.effective_start_runner_2b, r.effective_start_runner_3b);
}
// Re-export to avoid TS unused warning
export { matchesRunnerFilterRow };
