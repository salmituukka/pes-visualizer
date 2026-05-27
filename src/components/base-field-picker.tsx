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
        <svg viewBox="0 0 57 113" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          {/* Kentän rajat */}
          <g stroke="currentColor" fill="none" strokeWidth="0.4">
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
            {/* 3-pesän puoliympyrä vasemmalla */}
            <path d="M5 59.5 A 1 1 0 0 1 5 65.5" />
            {/* 2-pesän puoliympyrä oikealla */}
            <path d="M52 65.5 A 1 1 0 0 1 52 59.5" />
            {/* Lyöntiympyrä (1-pesä) */}
            <path d="M13.2 81 C 16,80 18,81 19.1 81.9" />
          </g>

          {/* Klikattavat pesät — koordinaatit lukittu */}
          {/* 3-pesä: (5, 62.5), 2-pesä: (52, 62.5), 1-pesä: (16, 81), Lyöjä: (28.5, 103) */}
          {/* Pesän ympärille klikattava ympyrä r=4-5, sen sisällä visuaalinen merkintä */}
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
