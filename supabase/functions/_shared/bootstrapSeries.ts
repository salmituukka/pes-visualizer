// ============================================================================
// bootstrapSeries.ts
// 
// Lataa series-list API:n datan ja populoi navigointitaulut:
//   seasons, series, series_groups, sport_clubs, sport_club_in_group
// 
// Kutsutaan:
//   - Ensikäynnistyksessä (jos seasons-taulu tyhjä)
//   - Käyttäjän "Päivitä sarjat" -nappulasta
//   - Mahdollisesti ajoittain kun uusi kausi alkaa
// 
// Suoritus kestää 30-60s (10MB JSON parsiminen + tuhansia upsertteja).
// Suositellaan ajamaan Edge Functionissa, ei selaimessa.
// ============================================================================

const PESISTULOKSET_API_BASE = 'https://api.pesistulokset.fi/api/v1';

// ============================================================================
// Raakadatatyypit (vain käytetyt kentät)
// ============================================================================

interface RawSeriesListResponse {
  updated: number;
  seasons: RawSeason[];
  sportClubs: RawSportClub[];
}

interface RawSeason {
  season: {
    id: number;
    season: number; // vuosi (esim. 2026)
  };
  seasonSerieses: RawSeasonSeries[];
}

interface RawSeasonSeries {
  seriesOrganizer: { id: number; name: string };
  seasonSeries: {
    id: number;
    name: string;
    level: number;
    series: number;
    season: number;
    slug: string;
    pesistv: boolean;
  };
  level: { id: number; name: string };
  series: { id: number; name: string };
  sportClubs: number[]; // seurojen ID:t
  phases: RawPhase[];
}

interface RawPhase {
  phase: {
    id: number;
    name: string;
    weight: number;
  };
  sportClubs?: number[];
  groups: RawGroup[];
}

interface RawGroup {
  group: {
    id: number;
    name: string;
    weight: number;
    is_playoff: boolean;
  };
  sportClubs: number[];
}

interface RawSportClub {
  id: number;
  name: string;
  shorthand: string;
  city: string;
  icon: string | null;
  square: string | null;
  logo: string | null;
}

// ============================================================================
// Tulostyypit
// ============================================================================

export type BootstrapResult =
  | { status: 'success'; counts: BootstrapCounts; duration_ms: number }
  | { status: 'error'; error: any; step?: string };

export interface BootstrapCounts {
  seasons: number;
  series: number;
  series_groups: number;
  sport_clubs: number;
  sport_club_in_group: number;
}

// ============================================================================
// Pääfunktio
// ============================================================================

/**
 * Bootstrap-toiminto: hae series-list ja populoi navigointitaulut.
 * 
 * Strategia:
 * - UPSERT-pohjainen: idempotentti, voidaan ajaa monta kertaa
 * - Bulk-operaatiot suorituskyvyn takia
 * - system_meta-tauluun tallennetaan viimeisin synkronointiaika
 */
export async function bootstrapSeries(
  supabase: any,
  apiKey: string
): Promise<BootstrapResult> {
  const startTime = Date.now();
  
  // 1. Hae series-list API:sta
  let rawData: RawSeriesListResponse;
  try {
    const url = `${PESISTULOKSET_API_BASE}/public/series-list?apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}`, step: 'fetch' };
    }
    rawData = await response.json();
  } catch (err) {
    return { status: 'error', error: err, step: 'fetch' };
  }
  
  // 2. Rakenna upsert-rivit
  const rows = buildBootstrapRows(rawData);
  
  // 3. Tallenna järjestyksessä (parents → children)
  
  // 3a. SportClubs (riippumaton kaikesta muusta)
  if (rows.sportClubs.length > 0) {
    const { error } = await supabase.from('sport_clubs').upsert(rows.sportClubs, {
      onConflict: 'sport_club_id',
    });
    if (error) return { status: 'error', error, step: 'sport_clubs' };
  }
  
  // 3b. Seasons
  if (rows.seasons.length > 0) {
    const { error } = await supabase.from('seasons').upsert(rows.seasons, {
      onConflict: 'season_id',
    });
    if (error) return { status: 'error', error, step: 'seasons' };
  }
  
  // 3c. Series (riippuu seasons:sta)
  if (rows.series.length > 0) {
    // Suuri data → tee chunkkeina (Supabase REST API rajoittaa rivimäärää per kutsu)
    for (const chunk of chunkArray(rows.series, 500)) {
      const { error } = await supabase.from('series').upsert(chunk, {
        onConflict: 'season_series_id',
      });
      if (error) return { status: 'error', error, step: 'series' };
    }
  }
  
  // 3d. Series_groups (riippuu series:sta)
  if (rows.series_groups.length > 0) {
    for (const chunk of chunkArray(rows.series_groups, 500)) {
      const { error } = await supabase.from('series_groups').upsert(chunk, {
        onConflict: 'group_id',
      });
      if (error) return { status: 'error', error, step: 'series_groups' };
    }
  }
  
  // 3e. Sport_club_in_group (riippuu groups + sport_clubs:sta)
  if (rows.sport_club_in_group.length > 0) {
    for (const chunk of chunkArray(rows.sport_club_in_group, 1000)) {
      const { error } = await supabase.from('sport_club_in_group').upsert(chunk, {
        onConflict: 'group_id,sport_club_id',
      });
      if (error) return { status: 'error', error, step: 'sport_club_in_group' };
    }
  }
  
  // 3f. Päivitä system_meta
  const { error: metaErr } = await supabase.from('system_meta').upsert({
    key: 'series_list_last_sync',
    value: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });
  if (metaErr) return { status: 'error', error: metaErr, step: 'system_meta' };
  
  return {
    status: 'success',
    counts: {
      seasons: rows.seasons.length,
      series: rows.series.length,
      series_groups: rows.series_groups.length,
      sport_clubs: rows.sportClubs.length,
      sport_club_in_group: rows.sport_club_in_group.length,
    },
    duration_ms: Date.now() - startTime,
  };
}

// ============================================================================
// Rivien rakentaminen
// ============================================================================

interface BootstrapRows {
  seasons: Array<{ season_id: number; year: number }>;
  series: Array<any>;
  series_groups: Array<any>;
  sportClubs: Array<any>;
  sport_club_in_group: Array<{ group_id: number; sport_club_id: number }>;
}

function buildBootstrapRows(raw: RawSeriesListResponse): BootstrapRows {
  const rows: BootstrapRows = {
    seasons: [],
    series: [],
    series_groups: [],
    sportClubs: [],
    sport_club_in_group: [],
  };
  
  // 1. Sport_clubs (top-level)
  for (const sc of raw.sportClubs) {
    rows.sportClubs.push({
      sport_club_id: sc.id,
      name: sc.name,
      shorthand: sc.shorthand,
      city: sc.city,
      logo_url: sc.logo,
      icon_url: sc.icon,
      square_url: sc.square,
    });
  }
  
  // 2. Seasons + series + series_groups + sport_club_in_group
  const seenGroupSportClub = new Set<string>(); // estää duplikaatit
  
  for (const seasonData of raw.seasons) {
    rows.seasons.push({
      season_id: seasonData.season.id,
      year: seasonData.season.season,
    });
    
    for (const ss of seasonData.seasonSerieses) {
      rows.series.push({
        season_series_id: ss.seasonSeries.id,
        season_id: ss.seasonSeries.season,
        name: ss.seasonSeries.name,
        level_id: ss.level.id,
        level_name: ss.level.name,
        series_id: ss.series.id,
        series_name: ss.series.name,
        organizer_id: ss.seriesOrganizer.id,
        organizer_name: ss.seriesOrganizer.name,
        slug: ss.seasonSeries.slug,
        pesistv: ss.seasonSeries.pesistv || false,
      });
      
      // Phases ja groups
      for (const phase of ss.phases || []) {
        for (const g of phase.groups || []) {
          rows.series_groups.push({
            group_id: g.group.id,
            season_series_id: ss.seasonSeries.id,
            name: g.group.name,
            is_playoff: g.group.is_playoff,
            phase_id: phase.phase.id,
          });
          
          // Sport_club_in_group jäsenyydet
          for (const sc_id of g.sportClubs || []) {
            const key = `${g.group.id}-${sc_id}`;
            if (!seenGroupSportClub.has(key)) {
              seenGroupSportClub.add(key);
              rows.sport_club_in_group.push({
                group_id: g.group.id,
                sport_club_id: sc_id,
              });
            }
          }
        }
      }
    }
  }
  
  return rows;
}

// ============================================================================
// Apufunktio: chunkkaa array suurempia bulk-operaatioita varten
// ============================================================================

function chunkArray<T>(arr: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}
