import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { refreshSingleMatch } from "@/lib/match-sync";
import { useQueryClient } from "@tanstack/react-query";

const COOLDOWN_MS = 30 * 1000;
const WINDOW_MS = 6 * 60 * 60 * 1000;
const STORAGE_PREFIX = "refresh-match:";

type Props = {
  matchId: number;
  matchDate: string | null;
  teamId: number;
  seasonSeriesId: number;
};

function getLastClick(matchId: number): number {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + matchId);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

function setLastClick(matchId: number, t: number) {
  try {
    localStorage.setItem(STORAGE_PREFIX + matchId, String(t));
  } catch {
    // ignore
  }
}

export function RefreshMatchButton({ matchId, matchDate, teamId, seasonSeriesId }: Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Sekuntilaskuri cooldownin näyttämiseen
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Näkyvyys: ottelu menneisyydessä ja < 6 h sitten
  const matchTime = matchDate ? new Date(matchDate).getTime() : null;
  if (!matchTime || matchTime > now || now - matchTime > WINDOW_MS) {
    return null;
  }

  const lastClick = getLastClick(matchId);
  const cooldownLeft = Math.max(0, COOLDOWN_MS - (now - lastClick));
  const inCooldown = cooldownLeft > 0 && !loading;

  const handleClick = async () => {
    setError(null);
    setLoading(true);
    setLastClick(matchId, Date.now());
    setNow(Date.now());
    try {
      await refreshSingleMatch(matchId, matchDate);
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          if (!Array.isArray(k) || typeof k[0] !== "string") return false;
          const keys = [
            "v-at-bat",
            "v-pitch",
            "opp-v-at-bat",
            "opp-v-pitch",
            "pitch-points",
            "opp-pitch-points",
            "team-matches",
          ];
          return keys.includes(k[0]) && k[1] === teamId && k[2] === seasonSeriesId;
        },
      });
    } catch (e) {
      console.error("[RefreshMatchButton]", e);
      setError("Päivitys epäonnistui, kokeile uudelleen");
    } finally {
      setLoading(false);
    }
  };

  let label: React.ReactNode;
  if (loading) {
    label = (
      <>
        <Loader2 className="h-4 w-4 animate-spin" />
        Päivitetään…
      </>
    );
  } else if (inCooldown) {
    label = `Odota ${Math.ceil(cooldownLeft / 1000)} s`;
  } else {
    label = (
      <>
        <RefreshCw className="h-4 w-4" />
        Päivitä
      </>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={loading || inCooldown}
        className="gap-2"
      >
        {label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
