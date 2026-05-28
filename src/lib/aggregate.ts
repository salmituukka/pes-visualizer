import { parseSlot, hasMeasured, type TeamFilters } from "./filters";

type AtBatRow = {
  team_id: number | null;
  player_id: number | null;
  batter_id: number | null;
  role_at_start: string | null;
  start_base: number | null;
  end_base: number | null;
  effective_start_runner_1b: number | null;
  effective_start_runner_2b: number | null;
  effective_start_runner_3b: number | null;
  had_hit_advance: boolean | null;
  got_out: boolean | null;
  got_wounded: boolean | null;
  goal_lead_advance: string | null;
  goal_tail_advance_runner: string | null;
  goal_tail_advance_batter: string | null;
  goal_no_outs: string | null;
  players: { full_name: string | null } | null;
};

type PitchRow = AtBatRow & {
  hit_number: number | null;
  start_runner_1b: number | null;
  start_runner_2b: number | null;
  start_runner_3b: number | null;
};

type Aggregated = Record<number, { full_name: string; successes: number; attempts: number }>;

function matchesSlot(slotValue: string, actual: number | null): boolean {
  const s = parseSlot(slotValue);
  switch (s.kind) {
    case "any":
    case "any_or_none":
    case "measured":
      return true;
    case "none":
      return actual === null;
    case "player":
      return actual === s.id;
  }
}

function matchesFilters(
  filters: TeamFilters,
  r1: number | null,
  r2: number | null,
  r3: number | null,
  batterId: number | null,
): boolean {
  if (!matchesSlot(filters.runner1, r1)) return false;
  if (!matchesSlot(filters.runner2, r2)) return false;
  if (!matchesSlot(filters.runner3, r3)) return false;
  if (!matchesSlot(filters.batter, batterId)) return false;
  return true;
}

function goalValue(
  r: {
    goal_lead_advance: string | null;
    goal_tail_advance_runner: string | null;
    goal_tail_advance_batter: string | null;
    goal_no_outs?: string | null;
    start_base: number | null;
  },
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
    if (!matchesFilters(filters, r.effective_start_runner_1b, r.effective_start_runner_2b, r.effective_start_runner_3b, r.batter_id)) continue;
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
    if (!matchesFilters(filters, r.start_runner_1b, r.start_runner_2b, r.start_runner_3b, r.batter_id)) continue;
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

export type DistributionRow = {
  player_id: number;
  full_name: string;
  total: number;
  scored: number;
  reached_3b: number;
  reached_2b: number;
  reached_1b: number;
  wounded: number;
  stayed: number;
  out: number;
};

function isPlayerNamedOnField(
  row: AtBatRow | PitchRow,
  filters: TeamFilters,
): boolean {
  const pid = row.player_id;
  if (pid == null) return false;

  const s1 = parseSlot(filters.runner1);
  const s2 = parseSlot(filters.runner2);
  const s3 = parseSlot(filters.runner3);
  const sb = parseSlot(filters.batter);

  const hasPlayerSlot =
    s1.kind === "player" ||
    s2.kind === "player" ||
    s3.kind === "player" ||
    sb.kind === "player";

  // Jos yksikään slot ei ole asetettu tiettyyn pelaajaan,
  // näytä kaikki pelaajat jotka ovat kentällä (start_base !== null)
  if (!hasPlayerSlot) {
    return row.start_base !== null;
  }

  // Jos jokin slot on asetettu tiettyyn pelaajaan,
  // näytä vain matchaavat pelaajat kyseisessä roolissaan
  const isRunner1 = pid === row.effective_start_runner_1b || row.start_base === 1;
  const isRunner2 = pid === row.effective_start_runner_2b || row.start_base === 2;
  const isRunner3 = pid === row.effective_start_runner_3b || row.start_base === 3;
  const isBatter = pid === row.batter_id || row.start_base === 0 || row.role_at_start === "batter";

  if (isRunner1 && s1.kind === "player" && s1.id === pid) return true;
  if (isRunner2 && s2.kind === "player" && s2.id === pid) return true;
  if (isRunner3 && s3.kind === "player" && s3.id === pid) return true;
  if (isBatter && sb.kind === "player" && sb.id === pid) return true;

  return false;
}

export function aggregateDistribution(
  rows: AtBatRow[] | PitchRow[],
  filters: TeamFilters,
  level: "at_bat" | "pitch",
): DistributionRow[] {
  const agg: Record<number, DistributionRow> = {};

  for (const r of rows) {
    const r1 = level === "pitch" ? (r as PitchRow).start_runner_1b : r.effective_start_runner_1b;
    const r2 = level === "pitch" ? (r as PitchRow).start_runner_2b : r.effective_start_runner_2b;
    const r3 = level === "pitch" ? (r as PitchRow).start_runner_3b : r.effective_start_runner_3b;

    if (!matchesFilters(filters, r1, r2, r3, r.batter_id)) continue;

    if (level === "pitch") {
      const hitNum = filters.hitNumber;
      if (hitNum === "1" || hitNum === "2" || hitNum === "3") {
        if ((r as PitchRow).hit_number !== Number(hitNum)) continue;
      }
    }

    if (!r.player_id) continue;

    if (!isPlayerNamedOnField(r, filters)) continue;

    const id = r.player_id;
    if (!agg[id]) {
      agg[id] = {
        player_id: id,
        full_name: r.players?.full_name ?? `#${id}`,
        total: 0, scored: 0, reached_3b: 0, reached_2b: 0,
        reached_1b: 0, wounded: 0, stayed: 0, out: 0,
      };
    }

    agg[id].total += 1;

    if (r.got_out || r.end_base === -1) {
      agg[id].out += 1;
    } else if (r.got_wounded) {
      agg[id].wounded += 1;
    } else if (r.end_base === 4) {
      agg[id].scored += 1;
    } else if (r.end_base === 3) {
      agg[id].reached_3b += 1;
    } else if (r.end_base === 2) {
      agg[id].reached_2b += 1;
    } else if (r.end_base === 1) {
      agg[id].reached_1b += 1;
    } else if (r.end_base === r.start_base) {
      agg[id].stayed += 1;
    } else {
      agg[id].total -= 1;
    }
  }

  return Object.values(agg).sort((a, b) => b.total - a.total);
}
