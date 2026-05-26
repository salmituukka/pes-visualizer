// ============================================================================
// syncResultBoard.ts
// 
// Lataa result-board-list API:n datan ja populoi joukkueet sarjalle:
//   teams, team_in_series_group
// 
// Kutsutaan kun käyttäjä avaa sarjan ensimmäistä kertaa (team_in_series_group
// puuttuu kyseiselle season_series_id:lle).
// 
// Kutsu kerralla per (season_series_id, phase). Phase=1 (runkosarja) oletuksena.
// API palauttaa kaikkien lohkojen joukkueet yhdellä kutsulla.
// ============================================================================

const PESISTULOKSET_API_BASE = 'https://api.pesistulokset.fi/api/v1';

// ============================================================================
// Raakadatatyypit
// ============================================================================

interface RawResultBoardResponse {
  data: RawGroupResults[];
}

interface RawGroupResults {
  group: {
    id: number;
    name: string;
  };
  phase: {
    id: number;
  };
  seasonSeries: {
    id: number;
  };
  resultBoard: RawTeamRow[];
}

interface RawTeamRow {
  num: number;
  team: {
    id: number;
    name: string;
    shorthand: string;
    three_letters: string;
    sport_club_id: number;
    sport_club?: {
      id: number;
      name: string;
      shorthand: string;
      city: string;
      icon: string | null;
      square: string | null;
      logo: string | null;
    };
    logo: string | null;
    square: string | null;
    icon: string | null;
  };
}

// ============================================================================
// Tulostyypit
// ============================================================================

export type SyncResultBoardResult =
  | { status: 'success'; teams: number; memberships: number }
  | { status: 'error'; error: any; step?: string };

// ============================================================================
// Pääfunktio
// ============================================================================

/**
 * Hakee sarjan joukkueet result-board-list API:sta ja populoi:
 *   - teams (joukkueet)
 *   - team_in_series_group (jäsenyydet)
 *   - sport_clubs (jos jokin uusi seura puuttuu — tämä on harvinaista koska
 *     bootstrap on jo populoinut kaikki)
 * 
 * Phase=1 (runkosarja) on oletusarvo.
 */
export async function syncResultBoard(
  supabase: any,
  season_series_id: number,
  apiKey: string,
  phase: number = 1
): Promise<SyncResultBoardResult> {
  // 1. Hae API:sta
  let rawData: RawResultBoardResponse;
  try {
    const url = `${PESISTULOKSET_API_BASE}/public/result-board-list?seasonSeries=${season_series_id}&phase=${phase}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}`, step: 'fetch' };
    }
    rawData = await response.json();
  } catch (err) {
    return { status: 'error', error: err, step: 'fetch' };
  }
  
  // 2. Rakenna upsert-rivit
  const teams: any[] = [];
  const memberships: any[] = [];
  const sportClubsUpsert: any[] = [];
  
  const seenTeamIds = new Set<number>();
  const seenSportClubIds = new Set<number>();
  
  for (const groupEntry of rawData.data || []) {
    const group_id = groupEntry.group.id;
    
    for (const row of groupEntry.resultBoard || []) {
      const t = row.team;
      
      // Team upsert
      if (!seenTeamIds.has(t.id)) {
        seenTeamIds.add(t.id);
        teams.push({
          team_id: t.id,
          sport_club_id: t.sport_club_id,
          name: t.name,
          shorthand: t.shorthand,
          three_letters: t.three_letters,
          logo_url: t.logo,
        });
      }
      
      // Sport_club upsert (defensiivinen: bootstrap normaalisti hoitaa tämän,
      // mutta jos seura on ilmestynyt myöhemmin, varmistetaan että se on kannassa)
      if (t.sport_club && !seenSportClubIds.has(t.sport_club_id)) {
        seenSportClubIds.add(t.sport_club_id);
        sportClubsUpsert.push({
          sport_club_id: t.sport_club.id,
          name: t.sport_club.name,
          shorthand: t.sport_club.shorthand,
          city: t.sport_club.city,
          logo_url: t.sport_club.logo,
          icon_url: t.sport_club.icon,
          square_url: t.sport_club.square,
        });
      }
      
      // Jäsenyys lohkossa
      memberships.push({
        group_id,
        team_id: t.id,
        season_series_id,
      });
    }
  }
  
  // 3. Tallenna järjestyksessä
  
  // 3a. Sport_clubs (defensiivinen — yleensä tyhjä)
  if (sportClubsUpsert.length > 0) {
    const { error } = await supabase.from('sport_clubs').upsert(sportClubsUpsert, {
      onConflict: 'sport_club_id',
    });
    if (error) return { status: 'error', error, step: 'sport_clubs' };
  }
  
  // 3b. Teams
  if (teams.length > 0) {
    const { error } = await supabase.from('teams').upsert(teams, {
      onConflict: 'team_id',
    });
    if (error) return { status: 'error', error, step: 'teams' };
  }
  
  // 3c. Memberships
  if (memberships.length > 0) {
    const { error } = await supabase.from('team_in_series_group').upsert(memberships, {
      onConflict: 'group_id,team_id',
    });
    if (error) return { status: 'error', error, step: 'team_in_series_group' };
  }
  
  return {
    status: 'success',
    teams: teams.length,
    memberships: memberships.length,
  };
}
