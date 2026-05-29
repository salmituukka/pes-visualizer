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
    if (
      !matchesFilters(
        filters,
        r.effective_start_runner_1b,
        r.effective_start_runner_2b,
        r.effective_start_runner_3b,
        r.batter_id,
      )
    )
      continue;
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

export type SlotKey = "batter" | "runner1" | "runner2" | "runner3";

export type DistributionRow = {
  slot: SlotKey;
  label: string;
  total: number;
  scored: number;
  reached_3b: number;
  reached_2b: number;
  reached_1b: number;
  wounded: number;
  stayed: number;
  out: number;
};

const SLOT_ORDER: SlotKey[] = ["batter", "runner1", "runner2", "runner3"];
const SLOT_LABELS: Record<SlotKey, string> = {
  batter: "Lyöjä",
  runner1: "1-pesä",
  runner2: "2-pesä",
  runner3: "3-pesä",
};
const SLOT_START_BASE: Record<SlotKey, number> = {
  batter: 0,
  runner1: 1,
  runner2: 2,
  runner3: 3,
};

function rowSlot(row: AtBatRow | PitchRow): SlotKey | null {
  switch (row.start_base) {
    case 0:
      return "batter";
    case 1:
      return "runner1";
    case 2:
      return "runner2";
    case 3:
      return "runner3";
    default:
      return null;
  }
}

export function aggregateDistribution(
  rows: AtBatRow[] | PitchRow[],
  filters: TeamFilters,
  level: "at_bat" | "pitch",
): DistributionRow[] {
  const slotState: Record<SlotKey, ReturnType<typeof parseSlot>> = {
    batter: parseSlot(filters.batter),
    runner1: parseSlot(filters.runner1),
    runner2: parseSlot(filters.runner2),
    runner3: parseSlot(filters.runner3),
  };

  const makeRow = (slot: SlotKey, label: string): DistributionRow => ({
    slot,
    label,
    total: 0,
    scored: 0,
    reached_3b: 0,
    reached_2b: 0,
    reached_1b: 0,
    wounded: 0,
    stayed: 0,
    out: 0,
  });

  const agg: Partial<Record<SlotKey, DistributionRow>> = {};

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

    const slot = rowSlot(r);
    if (!slot) continue;
    if (r.start_base !== SLOT_START_BASE[slot]) continue;

    const s = slotState[slot];
    if (s.kind === "none" || s.kind === "measured") continue;
    if (s.kind === "player" && s.id !== r.player_id) continue;

    const label = s.kind === "player" ? (r.players?.full_name ?? `#${r.player_id}`) : SLOT_LABELS[slot];

    if (!agg[slot]) agg[slot] = makeRow(slot, label);
    const a = agg[slot]!;
    a.total += 1;


    if (r.got_out || r.end_base === -1) a.out += 1;
    else if (r.got_wounded) a.wounded += 1;
    else if (r.end_base === 4) a.scored += 1;
    else if (r.end_base === 3) a.reached_3b += 1;
    else if (r.end_base === 2) a.reached_2b += 1;
    else if (r.end_base === 1) a.reached_1b += 1;
    else if (r.end_base === r.start_base) a.stayed += 1;
    else a.total -= 1;
  }

  return SLOT_ORDER.map((s) => agg[s]).filter((r): r is DistributionRow => !!r && r.total > 0);
}
