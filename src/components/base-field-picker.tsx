import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
};

export function BaseFieldPicker({ roster, values, onChange }: Props) {
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

      {/* Mobiili: bottom sheet */}
      {isMobile && (
        <Sheet open={openSlot !== null} onOpenChange={(o) => !o && setOpenSlot(null)}>
          <SheetContent side="bottom" className="max-h-[80vh]">
            {openSlot && (
              <>
                <SheetHeader>
                  <SheetTitle>
                    {openSlot === "batter" ? "Valitse lyöjä" : `Valitse ${SLOT_LABEL[openSlot]}`}
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="mt-4 max-h-[60vh]">
                  <SlotOptionsList
                    slot={openSlot}
                    roster={roster}
                    currentValue={values[openSlot]}
                    measuredSlot={measuredSlot}
                    onSelect={(v) => handleSelect(openSlot, v)}
                  />
                </ScrollArea>
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

  let fill = "hsl(var(--background))";
  let stroke = "hsl(var(--muted-foreground))";
  let strokeDasharray: string | undefined;
  let inner: React.ReactNode = null;

  if (parsed.kind === "any") {
    inner = (
      <text x={cx} y={cy} fontSize="3.5" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--muted-foreground))">
        ?
      </text>
    );
  } else if (parsed.kind === "none") {
    strokeDasharray = "1,0.6";
    inner = (
      <text x={cx} y={cy} fontSize="3.5" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--muted-foreground))">
        ∅
      </text>
    );
  } else if (parsed.kind === "any_or_none") {
    inner = (
      <text x={cx} y={cy} fontSize="2.8" textAnchor="middle" dominantBaseline="central" fill="hsl(var(--muted-foreground))">
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
    fill = "hsl(var(--primary))";
    stroke = "hsl(var(--primary))";
    inner = (
      <text x={cx} y={cy} fontSize="3" textAnchor="middle" dominantBaseline="central" fontWeight="bold" fill="hsl(var(--primary-foreground))">
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
        <PopoverContent className="w-64 p-0" side="right" align="center">
          <div className="p-3 border-b">
            <p className="text-sm font-semibold">
              {slot === "batter" ? "Valitse lyöjä" : `Valitse ${SLOT_LABEL[slot]}`}
            </p>
          </div>
          <ScrollArea className="max-h-[320px]">
            <SlotOptionsList
              slot={slot}
              roster={roster}
              currentValue={currentValue}
              measuredSlot={measuredSlot}
              onSelect={onSelect}
            />
          </ScrollArea>
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
  const sortedPlayers = [...roster].sort((a, b) =>
    sortableName(a.full_name).localeCompare(sortableName(b.full_name), "fi"),
  );

  return (
    <RadioGroup
      value={currentValue}
      onValueChange={onSelect}
      className="p-2"
    >
      {baseOptions.map((opt) => (
        <Label
          key={opt.value}
          htmlFor={`${slot}-${opt.value}`}
          className={cn(
            "flex items-start gap-2 rounded-md px-2 py-2 text-sm font-normal cursor-pointer hover:bg-accent",
            opt.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
          )}
        >
          <RadioGroupItem value={opt.value} id={`${slot}-${opt.value}`} disabled={opt.disabled} className="mt-0.5" />
          <span className="flex-1">
            {opt.label}
            {opt.note && <span className="block text-xs text-muted-foreground">{opt.note}</span>}
          </span>
        </Label>
      ))}

      <div className="my-2 border-t" />

      {sortedPlayers.length === 0 && (
        <p className="px-2 py-3 text-xs text-muted-foreground">Pelaajalistaa ladataan…</p>
      )}

      {sortedPlayers.map((p) => (
        <Label
          key={p.player_id}
          htmlFor={`${slot}-p-${p.player_id}`}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-normal cursor-pointer hover:bg-accent"
        >
          <RadioGroupItem value={String(p.player_id)} id={`${slot}-p-${p.player_id}`} />
          <span className="flex-1">{sortableName(p.full_name)}</span>
        </Label>
      ))}
    </RadioGroup>
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
