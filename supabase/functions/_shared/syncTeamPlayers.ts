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
//   data: pelaaja-otteluriviä (player x match)
//   maps:
//     player: lista { id, value: { id, first_name, last_name, name, image: {...} } }
//     matches: lista { id, value: { id, home, away, date, result: { runs_home_*, runs_away_* } } }
//     team: lista { id, value: { ... } }
//   (HUOM: maps.players on usein tyhjä — oikea pelaajalista on maps.player)
// ============================================================================
interface RawStatsToolResponse {
  data?: any[];
  maps?: {
    player?: Array<{ id: number; value: any }>;
    players?: Array<{ id: number; value: any }>;  // varmuuden vuoksi vanha nimi
    matches?: Array<{ id: number; value: any }>;
    team?: Array<{ id: number; value: any }>;
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

  // 2. Pura players (maps.player tai maps.players)
  const playerUpserts: any[] = [];
  const seenPlayerIds = new Set<number>();

  // Stats-tool palauttaa pelaajat avaimella 'player' (yksikkö), ei 'players'
  const playerList = rawData.maps?.player ?? rawData.maps?.players ?? [];

  for (const entry of playerList) {
    // Rakenne: { id: 283, value: { id, first_name, last_name, name, image: { medium, small } } }
    const p = entry.value ?? entry;
    const pid = typeof p?.id === 'number' ? p.id : (typeof entry.id === 'number' ? entry.id : null);

    if (pid === null || seenPlayerIds.has(pid)) continue;
    seenPlayerIds.add(pid);

    // Kuva: ota medium-versio jos saatavilla, muutoin small, muutoin original
    let imageUrl: string | null = null;
    if (p?.image && typeof p.image === 'object') {
      imageUrl = p.image.medium ?? p.image.small ?? p.image.original ?? null;
    } else if (typeof p?.image === 'string') {
      imageUrl = p.image;
    }

    playerUpserts.push({
      player_id: pid,
      first_name: p?.first_name ?? null,
      last_name: p?.last_name ?? null,
      full_name: p?.name ?? buildFullName(p),
      image_url: imageUrl,
      last_seen_at: new Date().toISOString(),
    });
  }

  // 3. Pura matches (maps.matches)
  // HUOM: stats-tool/players palauttaa vain ne ottelut joista on tilastoja
  // (pelatut/parsittavissa olevat). Aikataulutetut/live-ottelut puuttuvat,
  // joten haemme ne lisäksi /matches?team=X&type=all -endpointista (vaihe 3b).
  const matchUpserts: any[] = [];
  const seenMatchIds = new Set<number>();

  const matchList = rawData.maps?.matches ?? [];

  for (const entry of matchList) {
    const m = entry.value ?? entry;
    const mid = typeof m?.id === 'number' ? m.id : (typeof entry.id === 'number' ? entry.id : null);

    if (mid === null || seenMatchIds.has(mid)) continue;
    seenMatchIds.add(mid);

    const result = m?.result ?? {};
    const home_runs = sumRuns(
      result.runs_home_first_period,
      result.runs_home_second_period,
      result.runs_home_super_inning
    );
    const away_runs = sumRuns(
      result.runs_away_first_period,
      result.runs_away_second_period,
      result.runs_away_super_inning
    );

    matchUpserts.push({
      match_id: mid,
      season_series_id: season_series_id,
      home_team_id: m?.home ?? null,
      away_team_id: m?.away ?? null,
      match_date: m?.date ?? null,
      home_runs,
      away_runs,
    });
  }

  // 3b. Täydennä /matches?team=X&type=all -listalla: sisältää myös
  // aikataulutetut ja live-ottelut, joita stats-tool/players ei palauta.
  try {
    const url2 = `${PESISTULOKSET_API_BASE}/matches?team=${team_id}&type=all&apikey=${apiKey}`;
    const resp2 = await fetch(url2);
    if (resp2.ok) {
      const j: any = await resp2.json();
      const arr: any[] = Array.isArray(j?.data) ? j.data : [];
      for (const m of arr) {
        const mid = typeof m?.id === 'number' ? m.id : null;
        if (mid === null) continue;
        const ss = m?.series?.seasonSeries ?? null;
        // Käsittele vain saman sarjan ottelut — muut sarjat synkataan kun
        // käyttäjä siirtyy niihin.
        if (ss !== season_series_id) continue;

        const details = m?.result?.details ?? {};
        const home_runs = sumRuns(
          details.runs_home_first_period,
          details.runs_home_second_period,
          details.runs_home_super_inning
        );
        const away_runs = sumRuns(
          details.runs_away_first_period,
          details.runs_away_second_period,
          details.runs_away_super_inning
        );

        if (seenMatchIds.has(mid)) continue;
        seenMatchIds.add(mid);
        matchUpserts.push({
          match_id: mid,
          season_series_id: ss,
          home_team_id: m?.home ?? null,
          away_team_id: m?.away ?? null,
          match_date: m?.date ?? null,
          home_runs,
          away_runs,
        });
      }
    } else {
      console.warn('[syncTeamPlayers] /matches?team= returned', resp2.status);
    }
  } catch (err) {
    console.warn('[syncTeamPlayers] /matches?team= fetch failed:', err);
    // Ei kriittinen virhe — jatketaan jo kerätyillä otteluilla.
  }

  // 4. Tallenna

  // 4a. Players
  if (playerUpserts.length > 0) {
    const { error } = await supabase.from('players').upsert(playerUpserts, {
      onConflict: 'player_id',
    });
    if (error) return { status: 'error', error, step: 'players' };
  }

  // 4b. Matches — säilytä events-tila olemassa oleville
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
function sumRuns(...values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let hasAny = false;
  for (const v of values) {
    if (typeof v === 'number') {
      sum += v;
      hasAny = true;
    }
  }
  return hasAny ? sum : null;
}

function buildFullName(p: any): string | null {
  const first = p?.first_name ?? '';
  const last = p?.last_name ?? '';
  const combined = `${first} ${last}`.trim();
  return combined || null;
}
