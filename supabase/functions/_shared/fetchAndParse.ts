import { parseMatch } from './parseMatch.ts';
import { buildDatabaseRows } from './buildDatabaseRows.ts';
import { saveMatch, markMatchAsEmpty } from './saveMatch.ts';
import type { SupabaseLike, SaveResult } from './saveMatch.ts';
import type { RawEventsResponse } from './types.ts';

// ============================================================================
// Konfiguraatio
// ============================================================================

const PESISTULOKSET_API_BASE = 'https://api.pesistulokset.fi/api/v1';
const EVENTS_RETRY_DAYS = 7; // ottelu uudelleenyritetään jos < 7pv vanha

// ============================================================================
// Tulostyypit
// ============================================================================

export type FetchAndParseResult =
  | { status: 'skipped'; reason: 'already_parsed' | 'concurrent_fetch' }
  | { status: 'parsed'; has_pitch_detail: boolean; at_bat_count: number }
  | { status: 'empty'; reason: 'api_returned_empty' }
  | { status: 'error'; error: any; step?: string };

// ============================================================================
// Optimistinen tarkistus
// ============================================================================

/**
 * Tarkistaa onko ottelua tarpeen parsia, ja "varaa" sen samalla.
 * 
 * Palauttaa true jos parsinta pitäisi tehdä, false jos voidaan ohittaa.
 * 
 * Käyttää optimistista lukkoa: päivittää events_fetched_at NOW():ksi
 * ennen parsintaa. Jos useampi client yrittää samaan aikaan, vain ensimmäinen
 * onnistuu.
 */
export async function shouldFetchMatch(
  supabase: any,
  match_id: number,
  match_date_iso: string | null
): Promise<{ should_fetch: boolean; reason?: string }> {
  // Hae nykytila
  const { data: matchRow, error: fetchErr } = await supabase
    .from('matches')
    .select('events_available, events_fetched_at, match_date')
    .eq('match_id', match_id)
    .single();
  
  if (fetchErr) {
    return { should_fetch: false, reason: 'match_not_found' };
  }
  
  // Jos jo onnistuneesti parsittu, ohita
  if (matchRow.events_available === true) {
    return { should_fetch: false, reason: 'already_parsed' };
  }
  
  // Jos yritetty ja palautti tyhjän, tarkista onko < 7pv vanha
  if (matchRow.events_available === false) {
    const matchDate = matchRow.match_date || match_date_iso;
    if (matchDate) {
      const daysSince = (Date.now() - new Date(matchDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > EVENTS_RETRY_DAYS) {
        return { should_fetch: false, reason: 'too_old_to_retry' };
      }
    } else {
      // Jos match_date puuttuu, ole varovainen ja yritä uudelleen
    }
  }
  
  // Optimistinen lukko: aseta events_fetched_at NOW() jos ei ole
  // jo äsken asetettu (esim. toinen client parsii parhaillaan)
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const lastFetch = matchRow.events_fetched_at;
  
  if (lastFetch && lastFetch > oneMinuteAgo) {
    // Joku ehti yrittää viime minuutin aikana, anna sen tehdä
    return { should_fetch: false, reason: 'concurrent_fetch' };
  }
  
  // Varaa: päivitä events_fetched_at
  // (Tämä ei ole "atominen" mutta riittävä MVP:hen)
  const { error: updErr } = await supabase
    .from('matches')
    .update({ events_fetched_at: new Date().toISOString() })
    .eq('match_id', match_id);
  
  if (updErr) {
    return { should_fetch: false, reason: 'lock_failed' };
  }
  
  return { should_fetch: true };
}

// ============================================================================
// API-haku
// ============================================================================

/**
 * Hakee yhden ottelun events-data Pesistulokset-API:sta.
 * 
 * Palauttaa null jos API palautti tyhjän/virheen.
 */
export async function fetchMatchEvents(
  match_id: number,
  apiKey: string
): Promise<RawEventsResponse | null> {
  const url = `${PESISTULOKSET_API_BASE}/online/${match_id}/events?apikey=${apiKey}`;
  
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    // Verkkovirhe → palauta null, kutsuja päättää mitä tehdä
    return null;
  }
  
  if (!response.ok) {
    // 404 tai muu virhe → ottelua ei ole / ei dataa
    return null;
  }
  
  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    return null;
  }
  
  // Tyhjä vastaus
  if (!data || !data.events || !Array.isArray(data.events) || data.events.length === 0) {
    return null;
  }
  
  return data as RawEventsResponse;
}

// ============================================================================
// Pääfunktio: fetch + parse + save
// ============================================================================

/**
 * Kokonaisuus: hakee ottelun events-datan ja tallentaa parsittuna kantaan.
 * 
 * Tämä funktio toteuttaa MVP:n data flow:n ottelun osalta:
 *   1. Optimistinen tarkistus (onko jo parsittu / kuka muu parsii?)
 *   2. API-haku
 *   3. Parsinta
 *   4. Tallennus kantaan
 *   5. Virhetilanteet → matches.events_available=false (jolloin yritetään 
 *      uudelleen seuraavalla kutsulla jos < 7pv vanha)
 */
export async function fetchAndParseMatch(
  supabase: SupabaseLike & any,
  match_id: number,
  match_date_iso: string | null,
  apiKey: string
): Promise<FetchAndParseResult> {
  // 1. Tarkista onko parsinta tarpeen
  const check = await shouldFetchMatch(supabase, match_id, match_date_iso);
  if (!check.should_fetch) {
    if (check.reason === 'already_parsed' || check.reason === 'concurrent_fetch') {
      return { status: 'skipped', reason: check.reason };
    }
    return { status: 'skipped', reason: 'already_parsed' };
  }
  
  // 2. Hae API:sta
  const rawData = await fetchMatchEvents(match_id, apiKey);
  
  // 3. Jos tyhjä, merkitse tila ja palaa
  if (rawData === null) {
    const result = await markMatchAsEmpty(supabase, match_id);
    if (!result.success) {
      return { status: 'error', error: result.error, step: result.step };
    }
    return { status: 'empty', reason: 'api_returned_empty' };
  }
  
  // 4. Parsi
  const parsed = parseMatch(match_id, rawData);
  
  // 5. Rakenna DB-rivit
  const rows = buildDatabaseRows(parsed);
  
  // 6. Tallenna
  const saveResult = await saveMatch(supabase, rows);
  if (!saveResult.success) {
    return { status: 'error', error: saveResult.error, step: saveResult.step };
  }
  
  return {
    status: 'parsed',
    has_pitch_detail: parsed.has_pitch_detail,
    at_bat_count: parsed.at_bats.length,
  };
}

// ============================================================================
// Erä-haku (frontend-tilaan)
// ============================================================================

/**
 * Hakee useita otteluita rinnakkain. Rajoittaa rinnakkaisuuden 6:een
 * jotta selain ei tukehdu (selaimet rajoittavat HTTP-yhteyksiä per origin).
 * 
 * Tämä on tarkoitettu kutsuttavaksi frontendistä kun käyttäjä painaa
 * "Näytä tulokset" ja monta ottelua tarvitsee parsia.
 * 
 * Jos onProgress on annettu, kutsutaan sitä joka ottelun jälkeen.
 */
export async function fetchAndParseMatchBatch(
  supabase: SupabaseLike & any,
  matches: { match_id: number; match_date_iso: string | null }[],
  apiKey: string,
  options: {
    concurrency?: number;
    onProgress?: (done: number, total: number, lastResult: FetchAndParseResult) => void;
  } = {}
): Promise<FetchAndParseResult[]> {
  const concurrency = options.concurrency ?? 6;
  const results: FetchAndParseResult[] = new Array(matches.length);
  let done = 0;
  
  // Yksinkertainen rinnakkaiskäsittely: jaetaan eriin
  for (let i = 0; i < matches.length; i += concurrency) {
    const batch = matches.slice(i, i + concurrency);
    const batchPromises = batch.map((m, idx) =>
      fetchAndParseMatch(supabase, m.match_id, m.match_date_iso, apiKey).then(r => {
        results[i + idx] = r;
        done++;
        if (options.onProgress) options.onProgress(done, matches.length, r);
        return r;
      })
    );
    await Promise.allSettled(batchPromises);
  }
  
  return results;
}
