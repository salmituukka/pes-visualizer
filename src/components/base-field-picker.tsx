import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { pitchPointsQueryOptions, opponentPitchPointsQueryOptions, type PitchPoint } from "@/lib/queries";


import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { parseSlot } from "@/lib/filters";

export type RosterPlayer = {
  player_id: number;
  full_name: string | null;
};

export type SlotKey = "runner1" | "runner2" | "runner3" | "batter";

const SLOT_LABEL: Record<SlotKey, string> = {
  runner3: "3-pesä",
  runner2: "2-pesä",
  runner1: "1-pesä",
  batter: "Lyöjä",
};

// Pesien koordinaatit SVG-viewboxissa (0 0 57 113) — LUKITTU
const SLOT_POS: Record<SlotKey, { cx: number; cy: number }> = {
  runner3: { cx: 5, cy: 62.5 },
  runner2: { cx: 52, cy: 62.5 },
  runner1: { cx: 16, cy: 81 },
  batter: { cx: 28.5, cy: 103 },
};

type Props = {
  roster: RosterPlayer[];
  values: Record<SlotKey, string>;
  onChange: (slot: SlotKey, value: string) => void;
  teamId?: number;
  seasonSeriesId?: number;
  hitNumber?: string;
  matchId?: number;
};

const COLOR_MAP: Record<PitchPoint["outcome_color"], string> = {
  red: "#dc2626",
  yellow: "#eab308",
  green: "#16a34a",
  gray: "#9ca3af",
};

const MAX_POINTS = 1000;

function matchesRunnerSlot(filter: string, value: number | null): boolean {
  const p = parseSlot(filter);
  switch (p.kind) {
    case "any":
      return value !== null;
    case "any_or_none":
    case "measured":
      return true;
    case "none":
      return value == null;
    case "player":
      return value === p.id;
  }
}

function matchesBatterSlot(filter: string, value: number | null): boolean {
  const p = parseSlot(filter);
  if (p.kind === "player") return value === p.id;
  return true;
}

export function BaseFieldPicker({ roster, values, onChange, teamId, seasonSeriesId, hitNumber, matchId }: Props) {

  const [openSlot, setOpenSlot] = useState<SlotKey | null>(null);
  const isMobile = useIsMobile();

  // Mitattava-paikka (jos jokin slot = "measured")
  const measuredSlot = (Object.keys(values) as SlotKey[]).find(
    (k) => values[k] === "measured",
  );

  const handleSelect = (slot: SlotKey, value: string) => {
    // Yksi mitattava kerrallaan: jos asetetaan measured, nollataan vanha
    if (value === "measured" && measuredSlot && measuredSlot !== slot) {
      onChange(measuredSlot, "any");
    }
    onChange(slot, value);
    setOpenSlot(null);
  };

  const playersById = new Map(roster.map((p) => [p.player_id, p]));

  const enabled = !!teamId && !!seasonSeriesId && teamId > 0 && seasonSeriesId > 0;
  const { data: pitchPoints } = useQuery({
    ...pitchPointsQueryOptions(teamId ?? 0, seasonSeriesId ?? 0),
    enabled,
  });

  const filteredPoints = useMemo(() => {
    if (!pitchPoints) return [];
    return pitchPoints.filter((p) => {
      if (matchId && p.match_id !== matchId) return false;
      if (!matchesRunnerSlot(values.runner1, p.start_runner_1b)) return false;
      if (!matchesRunnerSlot(values.runner2, p.start_runner_2b)) return false;
      if (!matchesRunnerSlot(values.runner3, p.start_runner_3b)) return false;
      if (!matchesBatterSlot(values.batter, p.batter_id)) return false;
      if (hitNumber === "1" || hitNumber === "2" || hitNumber === "3") {
        if (p.hit_number !== Number(hitNumber)) return false;
      }
      return true;
    });
  }, [pitchPoints, values, hitNumber, matchId]);

  const visiblePoints = filteredPoints.slice(0, MAX_POINTS);


  return (
    <div className="space-y-3">
      <div className="relative mx-auto w-full max-w-[250px] md:max-w-[200px]">
        <svg
          viewBox="0 0 57 113"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
        >
          {/* Kentän rajat */}
          <g stroke="currentColor" fill="none" strokeWidth="0.4" className="text-muted-foreground">
            <line x1="5" y1="6" x2="52" y2="6" />
            <line x1="5" y1="5.9" x2="5" y2="81" />
            <line x1="52" y1="5.9" x2="52" y2="69" />
            <line x1="5" y1="69" x2="27" y2="101" />
            <line x1="52" y1="69" x2="30" y2="101" />
            <line x1="5" y1="81" x2="20" y2="101" />
            <line x1="18" y1="101" x2="40" y2="101" />
            <path d="M40 101 A 1 1 0 0 1 18 101" />
            <line x1="9.8" y1="87.4" x2="49.2" y2="64" />
            <line x1="8" y1="63.5" x2="49" y2="63.5" />
            <path d="M5 59.5 A 1 1 0 0 1 5 65.5" />
            <path d="M52 65.5 A 1 1 0 0 1 52 59.5" />
            <path d="M13.2 81 C 16,80 18,81 19.1 81.9" />
          </g>

          {/* Lyöntipisteet — renderöidään pesien alle */}
          {visiblePoints.length > 0 && (
            <g pointerEvents="none">
              {visiblePoints.map((p, i) => {
                const cx = (p.x / 100) * 57;
                const cy = (p.y / 100) * 113;
                return (
                  <circle
                    key={`${p.match_id}-${p.period}-${p.inning}-${p.bat_turn}-${p.at_bat_in_inning}-${p.hit_number}-${i}`}
                    cx={cx}
                    cy={cy}
                    r={1.5}
                    fill={COLOR_MAP[p.outcome_color]}
                    opacity={0.6}
                  />
                );
              })}
            </g>
          )}

          {(Object.keys(SLOT_POS) as SlotKey[]).map((slot) => (

            <SlotMarker
              key={slot}
              slot={slot}
              value={values[slot]}
              playersById={playersById}
              onClick={() => setOpenSlot(slot)}
            />
          ))}
        </svg>

        {/* Desktop: popovers ankkuroituna pesän kohdalle */}
        {!isMobile &&
          (Object.keys(SLOT_POS) as SlotKey[]).map((slot) => (
            <SlotPopoverAnchor
              key={slot}
              slot={slot}
              open={openSlot === slot}
              onOpenChange={(o) => setOpenSlot(o ? slot : null)}
              roster={roster}
              currentValue={values[slot]}
              measuredSlot={measuredSlot}
              onSelect={(v) => handleSelect(slot, v)}
            />
          ))}
      </div>

      <SummaryText values={values} playersById={playersById} />

      {filteredPoints.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MAP.green }} />
            Eteneminen
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MAP.yellow }} />
            Koppi
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MAP.red }} />
            Palo
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: COLOR_MAP.gray }} />
            Ei muutosta
          </span>
          <span className="ml-auto">
            {filteredPoints.length > MAX_POINTS
              ? `Näytetään ${MAX_POINTS}/${filteredPoints.length} lyöntiä`
              : `${filteredPoints.length} lyöntiä`}
          </span>
        </div>
      )}


      {/* Mobiili: bottom sheet */}
      {isMobile && (
        <Sheet open={openSlot !== null} onOpenChange={(o) => !o && setOpenSlot(null)}>
          <SheetContent side="bottom" className="max-h-[85vh] p-0 flex flex-col">
            {openSlot && (
              <>
                <SheetHeader className="p-4 pb-2">
                  <SheetTitle>
                    {openSlot === "batter" ? "Valitse lyöjä" : `Valitse ${SLOT_LABEL[openSlot]}`}
                  </SheetTitle>
                </SheetHeader>
                <div className="flex-1 min-h-0 px-2 pb-4">
                  <SlotOptionsList
                    slot={openSlot}
                    roster={roster}
                    currentValue={values[openSlot]}
                    measuredSlot={measuredSlot}
                    onSelect={(v) => handleSelect(openSlot, v)}
                  />
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

// ============================================================================
// SVG-merkki pesän visualisointiin
// ============================================================================

function SlotMarker({
  slot,
  value,
  playersById,
  onClick,
}: {
  slot: SlotKey;
  value: string;
  playersById: Map<number, RosterPlayer>;
  onClick: () => void;
}) {
  const { cx, cy } = SLOT_POS[slot];
  const parsed = parseSlot(value);
  const isMeasured = parsed.kind === "measured";
  const r = isMeasured ? 5 : 4;

  let fill = "var(--background)";
  let stroke = "var(--muted-foreground)";
  let strokeDasharray: string | undefined;
  let inner: React.ReactNode = null;

  if (parsed.kind === "any") {
    inner = (
      <text x={cx} y={cy} fontSize="3.5" textAnchor="middle" dominantBaseline="central" fill="var(--muted-foreground)">
        ?
      </text>
    );
  } else if (parsed.kind === "none") {
    strokeDasharray = "1,0.6";
    inner = (
      <text x={cx} y={cy} fontSize="3.5" textAnchor="middle" dominantBaseline="central" fill="var(--muted-foreground)">
        ∅
      </text>
    );
  } else if (parsed.kind === "any_or_none") {
    inner = (
      <text x={cx} y={cy} fontSize="2.8" textAnchor="middle" dominantBaseline="central" fill="var(--muted-foreground)">
        ?∅
      </text>
    );
  } else if (parsed.kind === "measured") {
    fill = "hsl(45 95% 55%)";
    stroke = "hsl(45 90% 35%)";
    inner = (
      <text x={cx} y={cy} fontSize="4.5" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fill="hsl(45 90% 15%)">
        ★
      </text>
    );
  } else if (parsed.kind === "player") {
    const p = playersById.get(parsed.id);
    fill = "var(--primary)";
    stroke = "var(--primary)";
    inner = (
      <text x={cx} y={cy} fontSize="3" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fill="var(--primary-foreground)">
        {initials(p?.full_name)}
      </text>
    );
  }

  return (
    <g className="cursor-pointer" onClick={onClick}>
      {/* Klikkialue */}
      <circle cx={cx} cy={cy} r={r + 2} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth="0.5"
        strokeDasharray={strokeDasharray}
      />
      {inner}
    </g>
  );
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ============================================================================
// Desktop: popover joka ankkuroituu pesän kohdalle (HTML-overlay)
// ============================================================================

function SlotPopoverAnchor({
  slot,
  open,
  onOpenChange,
  roster,
  currentValue,
  measuredSlot,
  onSelect,
}: {
  slot: SlotKey;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  roster: RosterPlayer[];
  currentValue: string;
  measuredSlot: SlotKey | undefined;
  onSelect: (v: string) => void;
}) {
  const { cx, cy } = SLOT_POS[slot];
  // Muutetaan SVG-koordinaatit prosenteiksi konteinerista (viewBox 57x113)
  const leftPct = (cx / 57) * 100;
  const topPct = (cy / 113) * 100;

  return (
    <div
      className="absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: 1,
        height: 1,
        pointerEvents: "none",
      }}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            aria-label={SLOT_LABEL[slot]}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ width: 24, height: 24, opacity: 0 }}
          />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" side="right" align="center">
          <SlotOptionsList
            slot={slot}
            roster={roster}
            currentValue={currentValue}
            measuredSlot={measuredSlot}
            onSelect={onSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ============================================================================
// Radio-lista (yhteinen desktop popoverille ja mobiili sheetille)
// ============================================================================

function SlotOptionsList({
  slot,
  roster,
  currentValue,
  measuredSlot,
  onSelect,
}: {
  slot: SlotKey;
  roster: RosterPlayer[];
  currentValue: string;
  measuredSlot: SlotKey | undefined;
  onSelect: (v: string) => void;
}) {
  const isBatter = slot === "batter";
  const measuredDisabled = !!measuredSlot && measuredSlot !== slot;

  const baseOptions: { value: string; label: string; disabled?: boolean; note?: string }[] = [
    { value: "any", label: "Kuka tahansa" },
  ];
  if (!isBatter) {
    baseOptions.push({ value: "none", label: "Ei kukaan" });
    baseOptions.push({ value: "any_or_none", label: "Kuka tahansa tai ei kukaan" });
  }
  baseOptions.push({
    value: "measured",
    label: "Mitattava",
    disabled: measuredDisabled,
    note: measuredDisabled ? `Mitattava on jo asetettu (${SLOT_LABEL[measuredSlot!]})` : undefined,
  });

  // Pelaajat: Sukunimi Etunimi -järjestys
  const sortedPlayers = roster
    .filter((player) => (player.full_name ?? "").trim().length > 0)
    .sort((a, b) => sortableName(a.full_name).localeCompare(sortableName(b.full_name), "fi"));

  return (
    <Command className="h-full max-h-[min(70vh,500px)]">
      <CommandInput placeholder="Hae pelaajaa..." />
      <CommandList className="max-h-none flex-1">
        <CommandEmpty>Ei tuloksia.</CommandEmpty>
        <CommandGroup>
          {baseOptions.map((opt) => (
            <CommandItem
              key={opt.value}
              value={`__opt_${opt.value}_${opt.label}`}
              disabled={opt.disabled}
              onSelect={() => !opt.disabled && onSelect(opt.value)}
              className={cn(
                "flex items-start gap-2",
                opt.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              <Check
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  currentValue === opt.value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="flex-1">
                {opt.label}
                {opt.note && <span className="block text-xs text-muted-foreground">{opt.note}</span>}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {sortedPlayers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pelaajat">
              {sortedPlayers.map((p) => {
                const name = sortableName(p.full_name) || `Pelaaja #${p.player_id}`;
                const idStr = String(p.player_id);
                return (
                  <CommandItem
                    key={p.player_id}
                    value={`${name} ${p.full_name ?? ""}`}
                    onSelect={() => onSelect(idStr)}
                    className="flex items-center gap-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        currentValue === idStr ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {sortedPlayers.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">Pelaajalistaa ladataan…</p>
        )}
      </CommandList>
    </Command>
  );
}

function sortableName(full: string | null): string {
  if (!full) return "";
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full.trim();
  const first = parts.slice(0, -1).join(" ");
  const last = parts[parts.length - 1];
  return `${last} ${first}`;
}

// ============================================================================
// Yhteenvetoteksti pesäkentän alle
// ============================================================================

function SummaryText({
  values,
  playersById,
}: {
  values: Record<SlotKey, string>;
  playersById: Map<number, RosterPlayer>;
}) {
  const parts: string[] = [];
  (Object.keys(SLOT_LABEL) as SlotKey[]).forEach((slot) => {
    const parsed = parseSlot(values[slot]);
    if (parsed.kind === "any") return;
    let label: string;
    switch (parsed.kind) {
      case "none":
        label = "Tyhjä";
        break;
      case "any_or_none":
        label = "Kuka tahansa tai tyhjä";
        break;
      case "measured":
        label = "★ Mitattava";
        break;
      case "player": {
        const p = playersById.get(parsed.id);
        label = sortableName(p?.full_name ?? null) || `#${parsed.id}`;
        break;
      }
      default:
        return;
    }
    parts.push(`${SLOT_LABEL[slot]}: ${label}`);
  });

  return (
    <p className="text-xs text-center text-muted-foreground min-h-[1.5em]">
      {parts.length === 0 ? "Pesätilanne ei rajattu" : parts.join(", ")}
    </p>
  );
}
