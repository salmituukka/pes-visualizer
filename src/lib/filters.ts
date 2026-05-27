import { z } from "zod";

export const baseSlotSchema = z.string(); // "none" | "measured" | playerId-string

export const teamFiltersSchema = z.object({
  seasonSeriesId: z.coerce.number(),
  groupId: z.coerce.number().optional(),
  runner1: baseSlotSchema.default("none"),
  runner2: baseSlotSchema.default("none"),
  runner3: baseSlotSchema.default("none"),
  hitNumber: z.enum(["1", "2", "3", "any-single", "turn"]).default("turn"),
  goal: z.enum(["lead_advance", "tail_advance", "no_outs"]).default("lead_advance"),
});

export type TeamFilters = z.infer<typeof teamFiltersSchema>;

export type ParsedSlot = { kind: "none" } | { kind: "measured" } | { kind: "player"; id: number };

export function parseSlot(v: string): ParsedSlot {
  if (v === "none") return { kind: "none" };
  if (v === "measured") return { kind: "measured" };
  const n = Number(v);
  if (Number.isFinite(n)) return { kind: "player", id: n };
  return { kind: "none" };
}

export function hasMeasured(f: TeamFilters): 1 | 2 | 3 | null {
  if (parseSlot(f.runner1).kind === "measured") return 1;
  if (parseSlot(f.runner2).kind === "measured") return 2;
  if (parseSlot(f.runner3).kind === "measured") return 3;
  return null;
}
