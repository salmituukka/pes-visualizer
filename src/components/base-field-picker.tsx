import { cn } from "@/lib/utils";

export type BaseSlot = "none" | "measured" | string; // string = playerId

export type RosterPlayer = { player_id: number; full_name: string | null };

type Props = {
  roster: RosterPlayer[];
  runner1: BaseSlot;
  runner2: BaseSlot;
  runner3: BaseSlot;
  onChange: (base: 1 | 2 | 3, value: BaseSlot) => void;
};

export function BaseFieldPicker({ roster, runner1, runner2, runner3, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="relative mx-auto aspect-square w-full max-w-[280px]">
        {/* Timanttipohja */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <polygon
            points="100,20 180,100 100,180 20,100"
            fill="hsl(var(--muted) / 0.4)"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          <circle cx="100" cy="100" r="8" fill="hsl(var(--muted-foreground) / 0.3)" />
        </svg>

        {/* Pesä-slotit */}
        <BaseSlotPicker
          label="3"
          className="left-0 top-1/2 -translate-y-1/2"
          value={runner3}
          onChange={(v) => onChange(3, v)}
          roster={roster}
        />
        <BaseSlotPicker
          label="2"
          className="left-1/2 top-0 -translate-x-1/2"
          value={runner2}
          onChange={(v) => onChange(2, v)}
          roster={roster}
        />
        <BaseSlotPicker
          label="1"
          className="right-0 top-1/2 -translate-y-1/2"
          value={runner1}
          onChange={(v) => onChange(1, v)}
          roster={roster}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Valitse pelaaja kullekin pesälle tai aseta "Mitattava" mitataksesi yhden pelaajan onnistumisia.
      </p>
    </div>
  );
}

function BaseSlotPicker({
  label,
  className,
  value,
  onChange,
  roster,
}: {
  label: string;
  className?: string;
  value: BaseSlot;
  onChange: (v: BaseSlot) => void;
  roster: RosterPlayer[];
}) {
  return (
    <div className={cn("absolute flex flex-col items-center gap-1", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-bold">
        {label}
      </div>
      <select
        className="w-32 rounded-md border border-input bg-background px-2 py-1 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value as BaseSlot)}
      >
        <option value="none">Tyhjä</option>
        <option value="measured">★ Mitattava</option>
        {roster.map((p) => (
          <option key={p.player_id} value={String(p.player_id)}>
            {p.full_name}
          </option>
        ))}
      </select>
    </div>
  );
}
