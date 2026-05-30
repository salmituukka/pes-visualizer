import { supabase } from "@/integrations/supabase/client";

const MAX_CONCURRENCY = 6;

// Sync players/matches melko aggressiivisesti: idempotentti upsert, mutta varmistaa
// että uudet ottelut (esim. äsken aikataulutettu / juuri pelattu) tulevat matches-tauluun
// jotta parsePendingMatches voi käsitellä ne.
const PLAYER_SYNC_TTL_MS = 60 * 60 * 1000; // 1 h

export async function ensurePlayerSync(team_id: number, season_series_id: number, last_sync: string | null) {
  const threshold = Date.now() - PLAYER_SYNC_TTL_MS;
  const needs = !last_sync || new Date(last_sync).getTime() < threshold;
  if (!needs) return;
  await supabase.functions.invoke("sync-team-players", {
    body: { team_id, season_series_id },
  });
}

export async function ensureResultBoard(season_series_id: number) {
  await supabase.functions.invoke("sync-result-board", {
    body: { season_series_id },
  });
}

export type ParseProgress = { done: number; total: number };

export type MatchSyncRow = {
  match_id: number;
  match_date: string | null;
  events_fetched_at: string | null;
  events_available: boolean | null;
};

/**
 * Palauttaa true jos ottelu pitäisi parsia uudelleen:
 * - match_date menneisyydessä mutta < 1 kk vanha
 * - viimeisestä parsintayrityksestä > 30 min (tai NULL)
 * - JOKO events_available ei ole true TAI parsittu liian aikaisin (< match_date + 6h)
 */
export function needsReparsing(m: MatchSyncRow): boolean {
  const now = Date.now();
  const matchTime = m.match_date ? new Date(m.match_date).getTime() : null;
  if (!matchTime || matchTime > now) return false;
  if (now - matchTime > 30 * 24 * 60 * 60 * 1000) return false;
  const lastFetch = m.events_fetched_at ? new Date(m.events_fetched_at).getTime() : null;
  if (lastFetch && now - lastFetch < 30 * 60 * 1000) return false;
  const notParsedOk = m.events_available !== true;
  const parsedTooEarly = lastFetch !== null && lastFetch < matchTime + 6 * 60 * 60 * 1000;
  return notParsedOk || parsedTooEarly;
}

/**
 * Parsii puuttuvat ottelut sekä ne joissa parsinta on tehty liian aikaisin / kesken.
 */
export async function parsePendingMatches(
  matches: MatchSyncRow[],
  onProgress: (p: ParseProgress) => void,
) {
  const pending = matches
    .filter((m) => !m.events_fetched_at || needsReparsing(m))
    .map((m) => ({
      match_id: m.match_id,
      match_date_iso: m.match_date,
      force: Boolean(m.events_fetched_at), // force vain re-parse-tapauksissa
    }));
  const total = pending.length;
  let done = 0;
  if (total === 0) {
    onProgress({ done: 0, total: 0 });
    return;
  }
  onProgress({ done, total });

  const queue = [...pending];
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, total) }, async () => {
    while (queue.length > 0) {
      const m = queue.shift();
      if (!m) break;
      try {
        await supabase.functions.invoke("fetch-and-parse-match", {
          body: { match_id: m.match_id, match_date_iso: m.match_date_iso, force: m.force },
        });
      } catch (e) {
        console.error("[parsePendingMatches] error", m.match_id, e);
      } finally {
        done += 1;
        onProgress({ done, total });
      }
    }
  });
  await Promise.all(workers);
}

/** Yhden ottelun pakotettu uudelleenparsinta (manuaalinen päivitä-nappi). */
export async function refreshSingleMatch(match_id: number, match_date_iso: string | null) {
  const { error } = await supabase.functions.invoke("fetch-and-parse-match", {
    body: { match_id, match_date_iso, force: true },
  });
  if (error) throw error;
}

/** @deprecated use parsePendingMatches */
export const parseMissingMatches = parsePendingMatches;
