import { supabase } from "@/integrations/supabase/client";

const MAX_CONCURRENCY = 6;

export async function ensurePlayerSync(team_id: number, season_series_id: number, last_sync: string | null) {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const needs = !last_sync || new Date(last_sync).getTime() < weekAgo;
  if (!needs) return;
  await supabase.functions.invoke("sync-team-players", {
    body: { team_id, season_series_id },
  });
}

export async function ensureResultBoard(season_series_id: number) {
  // Päivitä otteluluettelo (tulospalvelu) jotta tiedämme kaikki ottelut
  await supabase.functions.invoke("sync-result-board", {
    body: { season_series_id },
  });
}

export type ParseProgress = { done: number; total: number };

export async function parseMissingMatches(
  matches: { match_id: number; events_fetched_at: string | null }[],
  onProgress: (p: ParseProgress) => void,
) {
  const missing = matches.filter((m) => !m.events_fetched_at);
  const total = missing.length;
  let done = 0;
  if (total === 0) {
    onProgress({ done: 0, total: 0 });
    return;
  }
  onProgress({ done, total });

  const queue = [...missing];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, async () => {
    while (queue.length > 0) {
      const m = queue.shift();
      if (!m) break;
      try {
        await supabase.functions.invoke("fetch-and-parse-match", {
          body: { match_id: m.match_id },
        });
      } catch (e) {
        console.error("[parseMissingMatches] error", m.match_id, e);
      } finally {
        done += 1;
        onProgress({ done, total });
      }
    }
  });
  await Promise.all(workers);
}
