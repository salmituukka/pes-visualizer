// ============================================================================
// syncTeamPlayers.ts
// 
// Lataa stats-tool/players API:n datan ja populoi:
//   - players (pelaajien nimet, kuvat)
//   - matches (joukkueen ottelut)
// 
// Kutsutaan kun:
//   - Käyttäjä avaa joukkueen ensimmäistä kertaa
//   - teams.last_player_sync on > 7 päivää vanha
// 
// Tämä päivittää myös teams.last_player_sync = NOW().
// ============================================================================

const PESISTULOKSET_API_BASE = 'https://api.pesistulokset.fi/api/v1';

// ============================================================================
// Raakadatatyypit
// 
// stats-tool/players?team=X palauttaa:
//   data: pelaaja-otteluriviä (käytetään ainakin player_id:itä keräämään)
//   maps:
//     matches: ottelutiedot per match_id
//     players: pelaajatiedot per player_id
//     team: joukkueen metatiedot
// ============================================================================

interface RawStatsToolResponse {
  data?: any[];           // pelaajakohtaiset rivit (otteluittain)
  maps?: {
    matches?: Record<string, any> | any[];
    players?: Record<string, any> | any[];
    team?: any;
  };
}

// ============================================================================
// Tulostyypit
// ============================================================================

export type SyncTeamPlayersResult =
  | { status: 'success'; players: number; matches: number }
  | { status: 'error'; error: any; step?: string };

// ============================================================================
// Pääfunktio
// ============================================================================

/**
 * Hakee joukkueen pelaajat ja ottelut stats-tool API:sta ja populoi
 * players + matches taulut. Päivittää myös teams.last_player_sync.
 * 
 * Jos team-rivi puuttuu, sitä ei luoda (oletetaan että result-board on
 * synkattu ensin). Mutta jos rivi on, päivitetään vain last_player_sync.
 */
export async function syncTeamPlayers(
  supabase: any,
  team_id: number,
  season_series_id: number,
  apiKey: string
): Promise<SyncTeamPlayersResult> {
  // 1. Hae API:sta
  let rawData: RawStatsToolResponse;
  try {
    const url = `${PESISTULOKSET_API_BASE}/stats-tool/players?team=${team_id}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}`, step: 'fetch' };
    }
    rawData = await response.json();
  } catch (err) {
    return { status: 'error', error: err, step: 'fetch' };
  }
  
  // 2. Pura players
  const playerUpserts: any[] = [];
  const seenPlayerIds = new Set<number>();
  
  const playersMap = rawData.maps?.players;
  if (playersMap) {
    const playerEntries = normalizeMap(playersMap);
    for (const p of playerEntries) {
      const pid = extractPlayerId(p);
      if (pid === null || seenPlayerIds.has(pid)) continue;
      seenPlayerIds.add(pid);
      
      playerUpserts.push({
        player_id: pid,
        first_name: p.first_name ?? p.firstname ?? null,
        last_name: p.last_name ?? p.lastname ?? null,
        full_name: p.full_name ?? p.name ?? buildFullName(p),
        image_url: p.image ?? p.image_url ?? p.photo ?? null,
        last_seen_at: new Date().toISOString(),
      });
    }
  }
  
  // 3. Pura matches
  const matchUpserts: any[] = [];
  const seenMatchIds = new Set<number>();
  
  const matchesMap = rawData.maps?.matches;
  if (matchesMap) {
    const matchEntries = normalizeMap(matchesMap);
    for (const m of matchEntries) {
      const mid = extractMatchId(m);
      if (mid === null || seenMatchIds.has(mid)) continue;
      seenMatchIds.add(mid);
      
      matchUpserts.push({
        match_id: mid,
        season_series_id: m.season_series_id ?? m.seasonSeries?.id ?? season_series_id,
        home_team_id: m.home_team_id ?? m.home?.id ?? m.homeTeam?.id ?? null,
        away_team_id: m.away_team_id ?? m.away?.id ?? m.awayTeam?.id ?? null,
        match_date: m.match_date ?? m.date ?? m.start_time ?? null,
        home_runs: m.home_runs ?? m.home?.runs ?? null,
        away_runs: m.away_runs ?? m.away?.runs ?? null,
        // events-tila: jätetään NULL ellei jo aiempaa arvoa (UPSERT ei korvaa)
        // HUOM: Supabase UPSERT korvaa kaikki kentät — tämä tarvitaan käsiteltäväksi
      });
    }
  }
  
  // 4. Tallenna
  
  // 4a. Players
  if (playerUpserts.length > 0) {
    const { error } = await supabase.from('players').upsert(playerUpserts, {
      onConflict: 'player_id',
    });
    if (error) return { status: 'error', error, step: 'players' };
  }
  
  // 4b. Matches
  // Käytetään upsert mutta säilytetään events_*-kentät ennallaan jos rivi
  // jo on. Tämä tehdään käyttämällä INSERT...ON CONFLICT DO UPDATE -syntaksia
  // joka päivittää vain tietyt kentät.
  // 
  // Supabase REST API ei tue valikoivaa UPSERT-päivitystä suoraan, joten
  // teemme erikseen: hae olemassa olevat → erottele uudet vs päivitetyt.
  if (matchUpserts.length > 0) {
    const ids = matchUpserts.map(m => m.match_id);
    const { data: existing, error: selErr } = await supabase
      .from('matches')
      .select('match_id, events_fetched_at, events_available, has_pitch_detail')
      .in('match_id', ids);
    
    if (selErr) return { status: 'error', error: selErr, step: 'matches_select' };
    
    const existingMap = new Map<number, any>();
    for (const e of existing || []) {
      existingMap.set(e.match_id, e);
    }
    
    // Säilytä events-tila olemassa oleville
    const toUpsert = matchUpserts.map(m => {
      const ex = existingMap.get(m.match_id);
      if (ex) {
        return {
          ...m,
          events_fetched_at: ex.events_fetched_at,
          events_available: ex.events_available,
          has_pitch_detail: ex.has_pitch_detail,
        };
      } else {
        return {
          ...m,
          events_fetched_at: null,
          events_available: null,
          has_pitch_detail: null,
        };
      }
    });
    
    const { error } = await supabase.from('matches').upsert(toUpsert, {
      onConflict: 'match_id',
    });
    if (error) return { status: 'error', error, step: 'matches' };
  }
  
  // 4c. Päivitä teams.last_player_sync
  const { error: teamErr } = await supabase
    .from('teams')
    .update({ last_player_sync: new Date().toISOString() })
    .eq('team_id', team_id);
  if (teamErr) return { status: 'error', error: teamErr, step: 'teams' };
  
  return {
    status: 'success',
    players: playerUpserts.length,
    matches: matchUpserts.length,
  };
}

// ============================================================================
// Apufunktiot
// ============================================================================

/**
 * Muuntaa map-tyyppisen datan (joko object tai array) array:ksi.
 */
function normalizeMap(map: Record<string, any> | any[]): any[] {
  if (Array.isArray(map)) return map;
  return Object.values(map);
}

function extractPlayerId(p: any): number | null {
  if (typeof p?.id === 'number') return p.id;
  if (typeof p?.player_id === 'number') return p.player_id;
  if (typeof p?.id === 'string') {
    const n = parseInt(p.id, 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

function extractMatchId(m: any): number | null {
  if (typeof m?.id === 'number') return m.id;
  if (typeof m?.match_id === 'number') return m.match_id;
  if (typeof m?.id === 'string') {
    const n = parseInt(m.id, 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

function buildFullName(p: any): string | null {
  const first = p.first_name ?? p.firstname ?? '';
  const last = p.last_name ?? p.lastname ?? '';
  const combined = `${first} ${last}`.trim();
  return combined || null;
}
