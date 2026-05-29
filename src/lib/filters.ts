import { z } from "zod";

// Slot value stored URL-safe: "any" | "none" | "any_or_none" | "measured" | "<playerId>"
export const baseSlotSchema = z.string();

export const teamFiltersSchema = z.object({
  seasonSeriesId: z.coerce.number(),
  groupId: z.coerce.number().optional(),
  runner1: baseSlotSchema.default("any_or_none"),
  runner2: baseSlotSchema.default("any_or_none"),
  runner3: baseSlotSchema.default("any_or_none"),
  batter: baseSlotSchema.default("any"),
  hitNumber: z.enum(["1", "2", "3", "any-single", "turn"]).default("turn"),
  goal: z.enum(["lead_advance", "tail_advance", "no_outs"]).default("lead_advance"),
});

export type TeamFilters = z.infer<typeof teamFiltersSchema>;

export type ParsedSlot =
  | { kind: "any" }
  | { kind: "none" }
  | { kind: "any_or_none" }
  | { kind: "measured" }
  | { kind: "player"; id: number };

export function parseSlot(v: string): ParsedSlot {
  if (v === "any" || v === "" || v == null) return { kind: "any" };
  if (v === "none") return { kind: "none" };
  if (v === "any_or_none") return { kind: "any_or_none" };
  if (v === "measured") return { kind: "measured" };
  const n = Number(v);
  if (Number.isFinite(n)) return { kind: "player", id: n };
  return { kind: "any" };
}

/** Palauttaa 0 = lyöjä, 1|2|3 = pesä, null = ei mitattavaa. */
export function hasMeasured(f: TeamFilters): 0 | 1 | 2 | 3 | null {
  if (parseSlot(f.batter).kind === "measured") return 0;
  if (parseSlot(f.runner1).kind === "measured") return 1;
  if (parseSlot(f.runner2).kind === "measured") return 2;
  if (parseSlot(f.runner3).kind === "measured") return 3;
  return null;
}
