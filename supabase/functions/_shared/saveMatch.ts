import type { MatchDatabaseRows } from './buildDatabaseRows.ts';

// ============================================================================
// Supabase-tyyppi (yksinkertainen, vain tarvittavat metodit)
// ============================================================================

export interface SupabaseLike {
  from(table: string): SupabaseQueryBuilder;
}

export interface SupabaseQueryBuilder {
  upsert(rows: any[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<{ error: any | null }>;
  update(values: any): SupabaseUpdateBuilder;
}

export interface SupabaseUpdateBuilder {
  eq(column: string, value: any): Promise<{ error: any | null }>;
}

// ============================================================================
// Tallennusoperaation tulos
// ============================================================================

export interface SaveResult {
  success: boolean;
  error?: any;
  step?: string; // mikä vaihe epäonnistui
}

// ============================================================================
// Pääfunktio
// ============================================================================

/**
 * Tallentaa parsitun ottelun Supabaseen UPSERT-strategialla.
 * 
 * Strategia:
 * - Kaikki taulut käyttävät luonnollisia avaimia ja UPSERT (idempotentti)
 * - Tallennus tehdään loogisessa järjestyksessä (parents → children)
 * - matches.events_available=true asetetaan VIIMEISENÄ — toimii "valmiusmerkkinä"
 * - Jos jokin vaihe epäonnistuu, palautetaan virhe; data jää osittaiseksi mutta
 *   matches.events_available pysyy false:na, jolloin seuraava parsintayritys
 *   uudelleenkäynnistää operaation
 */
export async function saveMatch(
  supabase: SupabaseLike,
  rows: MatchDatabaseRows
): Promise<SaveResult> {
  // 1. Players (minimi-upsert, nimet päivitetään myöhemmin stats-toolista)
  if (rows.player_upserts.length > 0) {
    const { error } = await supabase
      .from('players')
      .upsert(rows.player_upserts, {
        onConflict: 'player_id',
        ignoreDuplicates: false, // päivitä last_seen_at vaikka rivi on jo
      });
    if (error) return { success: false, error, step: 'players' };
  }
  
  // 2. At_bats
  if (rows.at_bats.length > 0) {
    const { error } = await supabase
      .from('at_bats')
      .upsert(rows.at_bats, {
        onConflict: 'match_id,period,inning,bat_turn,at_bat_in_inning',
      });
    if (error) return { success: false, error, step: 'at_bats' };
  }
  
  // 3. At_bat_participants
  if (rows.at_bat_participants.length > 0) {
    const { error } = await supabase
      .from('at_bat_participants')
      .upsert(rows.at_bat_participants, {
        onConflict: 'match_id,period,inning,bat_turn,at_bat_in_inning,player_id',
      });
    if (error) return { success: false, error, step: 'at_bat_participants' };
  }
  
  // 4. Pitches (vain has_pitch_detail=true otteluille, mutta tämä on jo huomioitu
  //    buildDatabaseRows:ssa — huonolaatuisille rows.pitches on tyhjä)
  if (rows.pitches.length > 0) {
    const { error } = await supabase
      .from('pitches')
      .upsert(rows.pitches, {
        onConflict: 'match_id,period,inning,bat_turn,at_bat_in_inning,hit_number',
      });
    if (error) return { success: false, error, step: 'pitches' };
  }
  
  // 5. Pitch_participants
  if (rows.pitch_participants.length > 0) {
    const { error } = await supabase
      .from('pitch_participants')
      .upsert(rows.pitch_participants, {
        onConflict: 'match_id,period,inning,bat_turn,at_bat_in_inning,hit_number,player_id',
      });
    if (error) return { success: false, error, step: 'pitch_participants' };
  }
  
  // 6. Segments
  if (rows.segments.length > 0) {
    const { error } = await supabase
      .from('segments')
      .upsert(rows.segments, {
        onConflict: 'match_id,period,inning,bat_turn,at_bat_in_inning,sequence',
      });
    if (error) return { success: false, error, step: 'segments' };
  }
  
  // 7. VIIMEISENÄ: matches-rivin päivitys (valmiusmerkki)
  const { error } = await supabase
    .from('matches')
    .update({
      events_fetched_at: rows.match_update.events_fetched_at,
      events_available: rows.match_update.events_available,
      has_pitch_detail: rows.match_update.has_pitch_detail,
    })
    .eq('match_id', rows.match_update.match_id);
  if (error) return { success: false, error, step: 'matches' };
  
  return { success: true };
}

/**
 * Markkaa ottelu "yritetty mutta tyhjä" -tilaan.
 * Käytetään kun API palauttaa tyhjän vastauksen.
 */
export async function markMatchAsEmpty(
  supabase: SupabaseLike,
  match_id: number
): Promise<SaveResult> {
  const { error } = await supabase
    .from('matches')
    .update({
      events_fetched_at: new Date().toISOString(),
      events_available: false,
      has_pitch_detail: false,
    })
    .eq('match_id', match_id);
  
  if (error) return { success: false, error, step: 'matches_empty' };
  return { success: true };
}
