import type {
  RawEventsResponse,
  RawEvent,
  RawSubEvent,
  RawHit,
  RawTextItem,
  ParsedMatch,
  ParsedAtBat,
  ParsedPitch,
  ParsedSegment,
  ParsedPitchRecord,
  ParsedAtBatParticipant,
  SegmentReason,
  PlayerRole,
} from "./types.ts";

// ============================================================================
// PÄÄFUNKTIO
// ============================================================================

/**
 * Parsii Pesistulokset-API:n /online/{match_id}/events -vastauksen.
 *
 * @param matchId Ottelun ID
 * @param rawResponse API-vastaus (null tai tyhjä events = events ei saatavilla)
 * @returns Parsittu ottelu valmiina tallennettavaksi
 */
export function parseMatch(matchId: number, rawResponse: RawEventsResponse | null): ParsedMatch {
  // Tapaus: API palautti tyhjän tai null
  if (!rawResponse || !rawResponse.events || rawResponse.events.length === 0) {
    return {
      match_id: matchId,
      has_pitch_detail: false,
      events_available: false,
      at_bats: [],
      players_seen: new Set(),
    };
  }

  // Vaihe 1: Datalaadun arviointi
  const has_pitch_detail = assessDataQuality(rawResponse.events);

  // Vaihe 2: Ryhmittely + sub-event-parsinta
  const at_bats = groupAndParseEvents(rawResponse.events, has_pitch_detail);

  // Vaihe 3: Aggregaatit (effective start, roolit, flagit)
  for (const ab of at_bats) {
    computeAtBatAggregates(ab, has_pitch_detail);
  }

  // Kerää kaikki nähdyt pelaajat
  const players_seen = new Set<number>();
  for (const ab of at_bats) {
    if (ab.batter_id) players_seen.add(ab.batter_id);
    for (const p of ab.participants) players_seen.add(p.player_id);
    for (const s of ab.pre_hit_segments) {
      if (s.player_id) players_seen.add(s.player_id);
    }
    for (const p of ab.pitches) {
      for (const s of p.segments) {
        if (s.player_id) players_seen.add(s.player_id);
      }
    }
  }

  return {
    match_id: matchId,
    has_pitch_detail,
    events_available: true,
    at_bats,
    players_seen,
  };
}

// ============================================================================
// VAIHE 1: Datalaadun arviointi
// ============================================================================

/**
 * Tunnistaa onko datassa riittävästi koordinaatti-informaatiota lyöntikohtaista
 * analyysiä varten. Kynnys: vähintään 50 % lyönneistä saa x,y ≠ (0,0).
 */
function assessDataQuality(events: RawEvent[]): boolean {
  let totalHits = 0;
  let realXyHits = 0;

  for (const ev of events) {
    if (ev.hit) {
      totalHits++;
      if (!(ev.hit.x === "0.00" && ev.hit.y === "0.00")) {
        realXyHits++;
      }
    }
  }

  if (totalHits === 0) return false;
  return realXyHits / totalHits >= 0.5;
}

// ============================================================================
// VAIHE 2: Ryhmittely ja sub-event-parsinta
// ============================================================================

function groupAndParseEvents(rawEvents: RawEvent[], has_pitch_detail: boolean): ParsedAtBat[] {
  const at_bats: ParsedAtBat[] = [];
  let current_atbat: ParsedAtBat | null = null;
  let current_pitch: ParsedPitch | null = null;
  let prev_bases: (number | null)[] = [null, null, null, null, null];

  const closePitch = () => {
    if (current_pitch && current_atbat) {
      applyWalkInduced(current_pitch.segments);
      current_atbat.pitches.push(current_pitch);
      current_pitch = null;
    }
  };

  const closeAtBat = () => {
    closePitch();
    if (current_atbat) {
      at_bats.push(current_atbat);
      current_atbat = null;
    }
  };

  for (const ev of rawEvents) {
    // Käsittele vain pelilliset eventit (o, he)
    if (ev.groupType !== "o" && ev.groupType !== "he") continue;

    // At-bat-rajan tarkistus (period, inning, batTurn, batter -muutos)
    const atbat_key_changed =
      !current_atbat ||
      current_atbat.period !== ev.period ||
      current_atbat.inning !== ev.inning ||
      current_atbat.batTurn !== ev.batTurn ||
      current_atbat.batter_id !== ev.batter;

    if (atbat_key_changed) {
      closeAtBat();

      // Tarkista onko vuoropari vaihtunut (eri period, inning tai batTurn).
      // Tällöin edellinen prev_bases (= edellisen vuoroparin lopputila) ei ole oikea,
      // vaan käytetään uuden eventin OMAA alkutilaa (= ensimmäisen sub-eventin runnersAtBases).
      //
      // Tämä korjaa bugin jossa vastustajan pelaajat jäivät kentälle uuden vuoroparin alussa.
      const vuoropari_vaihtui =
        at_bats.length === 0 || // ensimmäinen vuoro, aina "vaihtui"
        at_bats[at_bats.length - 1].period !== ev.period ||
        at_bats[at_bats.length - 1].inning !== ev.inning ||
        at_bats[at_bats.length - 1].batTurn !== ev.batTurn;

      if (vuoropari_vaihtui && ev.events.length > 0 && ev.events[0].runnersAtBases) {
        // Käytä uuden eventin ENSIMMÄISEN sub-eventin pesätilaa
        prev_bases = [...ev.events[0].runnersAtBases];
      }

      current_atbat = createEmptyAtBat(ev, prev_bases);
    }

    const ev_hN = ev.hitNumber;

    // Huonolaatuiselle datalle: in_pitch_context aina true, is_pre_hit aina false
    const forceInPitch = !has_pitch_detail;

    if (ev_hN !== null && ev_hN !== undefined) {
      // Uusi lyönti alkaa
      closePitch();
      current_pitch = {
        hit_number: ev_hN,
        start_bases: [...prev_bases],
        pitch_record: null,
        segments: [],
      };
      processEventSubs(
        ev,
        current_pitch.segments,
        prev_bases,
        /* in_pitch_context */ true,
        /* is_pre_hit */ false,
        current_pitch,
      );
    } else {
      // hitNumber on null
      if (current_pitch !== null) {
        // Jatko-eventti edelliseen lyöntiin
        processEventSubs(ev, current_pitch.segments, prev_bases, true, false);
      } else {
        // Pre-hit (hyvälaatuiselle) tai osa at_batia (huonolaatuiselle)
        // Huonolaatuiselle: in_pitch_context=true, is_pre_hit=false
        // Hyvälaatuiselle: in_pitch_context=false, is_pre_hit=true
        processEventSubs(
          ev,
          current_atbat!.pre_hit_segments,
          prev_bases,
          /* in_pitch_context */ forceInPitch,
          /* is_pre_hit */ !forceInPitch,
        );
      }
    }

    // Päivitä prev_bases viimeisestä sub-eventistä seuraavaa tapahtumaa varten
    const lastSub = ev.events[ev.events.length - 1];
    if (lastSub?.runnersAtBases) {
      prev_bases = [...lastSub.runnersAtBases];
    }
  }

  closeAtBat();
  return at_bats;
}

function createEmptyAtBat(ev: RawEvent, prev_bases: (number | null)[]): ParsedAtBat {
  return {
    period: ev.period!,
    inning: ev.inning!,
    batTurn: ev.batTurn!,
    batter_id: ev.batter!,
    team_id: ev.team!,
    raw_start_bases: [...prev_bases],
    effective_start_bases: [],
    pre_hit_segments: [],
    pitches: [],
    original_lead_player: null,
    original_lead_disqualified: false,
    any_out: false,
    participants: [],
  };
}

function processEventSubs(
  ev: RawEvent,
  target_segments: ParsedSegment[],
  outer_prev_bases: (number | null)[],
  in_pitch_context: boolean,
  is_pre_hit: boolean,
  current_pitch?: ParsedPitch,
): void {
  let local_prev = [...outer_prev_bases];

  for (const sub of ev.events) {
    const parsed = parseSubEvent(sub, local_prev, in_pitch_context);

    if (parsed.kind === "pitch_record" && current_pitch) {
      current_pitch.pitch_record = parsed.record;
    } else if (parsed.kind === "segment") {
      target_segments.push({
        ...parsed.segment,
        is_pre_hit,
      });
    }
    // 'settling' ja 'unknown' ohitetaan

    if (sub.runnersAtBases) {
      local_prev = [...sub.runnersAtBases];
    }
  }
}

type SubParseResult =
  | { kind: "pitch_record"; record: ParsedPitchRecord }
  | { kind: "settling" }
  | { kind: "segment"; segment: Omit<ParsedSegment, "is_pre_hit"> }
  | { kind: "unknown" };

function parseSubEvent(sub: RawSubEvent, prev_bases: (number | null)[], in_pitch_context: boolean): SubParseResult {
  const types = new Set<string>();
  let player_id: number | null = null;
  let event_text: string | null = null;
  let hit_data: RawHit | null = null;

  for (const t of sub.texts) {
    if (typeof t === "string") continue;
    types.add(t.type);
    if (t.type === "player" && player_id === null) {
      player_id = (t as any).id;
    } else if (t.type === "event" && event_text === null) {
      event_text = (t as any).text;
    } else if (t.type === "hit") {
      hit_data = (t as any).hit;
    }
  }

  // 1. Pitch record (lyönti itse)
  if (types.has("hit") && hit_data) {
    return {
      kind: "pitch_record",
      record: {
        hit_id: hit_data.id,
        x: hit_data.x,
        y: hit_data.y,
        caught: types.has("hit-caught"),
        illegal: types.has("hit-out"),
      },
    };
  }

  // 2. Settling (vain pelaaja, ei eventiä)
  if (types.has("player") && !event_text) {
    return { kind: "settling" };
  }

  // 3. Tuntematon (esim. ei pelaajaa eikä eventiä)
  if (!event_text || player_id === null) {
    return { kind: "unknown" };
  }

  // 4. Varsinainen segmentti
  const from_base = findPlayerInBases(player_id, prev_bases, 4);
  let to_base: number | null = null;
  let reason: SegmentReason;

  if (event_text === "paloi") {
    to_base = -1;
    reason = in_pitch_context ? "hit_out" : "non_pitch_out";
  } else if (event_text === "haavoittui") {
    to_base = -2;
    reason = "hit_wounded";
  } else {
    // Etsi pelaaja nykyisestä tilasta
    to_base = findPlayerInBases(player_id, sub.runnersAtBases, 5);

    if (event_text === "eteni") {
      reason = in_pitch_context ? "hit_advance" : "non_pitch_advance";
    } else if (event_text === "löi kunnarin!") {
      reason = "hit_homerun";
    } else if (event_text === "eteni harhaheitolla") {
      reason = "error_advance";
    } else if (event_text === "karkasi") {
      reason = "steal";
    } else if (event_text.includes("vapaataipaleen")) {
      reason = "walk";
    } else {
      reason = "unknown";
    }
  }

  return {
    kind: "segment",
    segment: {
      player_id,
      event_text,
      from_base,
      to_base,
      reason,
    },
  };
}

/**
 * Etsii pelaajan ID:n pesien listalta. Palauttaa indeksin tai null.
 * maxIndex = 4 (0-3 = lyöjä + pesät) tai 5 (0-4 = + kotipesä)
 */
function findPlayerInBases(player_id: number, bases: (number | null)[], maxIndex: number): number | null {
  const limit = Math.min(maxIndex, bases.length);
  for (let i = 0; i < limit; i++) {
    if (bases[i] === player_id) return i;
  }
  return null;
}

/**
 * Walk-induced post-prosessointi: jos eventissä on walk-segmentti,
 * kaikki saman eventin 'eteni'-segmentit muunnetaan walk_induced:ksi.
 *
 * HUOM: kutsutaan pitch-tasolla koska walk-segmentti ja siitä johdetut
 * eteni-segmentit ovat aina samassa lyöntirakenteessa.
 */
function applyWalkInduced(segments: ParsedSegment[]): void {
  const hasWalk = segments.some((s) => s.reason === "walk");
  if (!hasWalk) return;

  for (const s of segments) {
    if (s.reason === "hit_advance" && s.event_text === "eteni") {
      s.reason = "walk_induced";
    }
  }
}

// ============================================================================
// VAIHE 3: Aggregaattien laskenta
// ============================================================================

function computeAtBatAggregates(atbat: ParsedAtBat, has_pitch_detail: boolean): void {
  // Effective start state
  if (has_pitch_detail && atbat.pitches.length > 0) {
    atbat.effective_start_bases = [...atbat.pitches[0].start_bases];
  } else {
    atbat.effective_start_bases = [...atbat.raw_start_bases];
  }

  // Alkuperäinen kärki
  atbat.original_lead_player = findLeadRunner(atbat.effective_start_bases, atbat.batter_id);

  // Kerää kaikki segmentit jotka vaikuttavat at-bat-tason laskelmiin:
  // - In-hit segmentit kaikista pitcheistä
  // - Huonolaatuiselle: myös pre_hit_segments (jotka ovat oikeasti in-hit)
  const all_segments: ParsedSegment[] = [];
  for (const pitch of atbat.pitches) {
    all_segments.push(...pitch.segments);
  }
  if (!has_pitch_detail) {
    all_segments.push(...atbat.pre_hit_segments);
  }

  // original_lead_disqualified: alkuperäinen kärki PALOI (vain palo, ei haavoittuminen)
  if (atbat.original_lead_player !== null) {
    atbat.original_lead_disqualified = all_segments.some(
      (s) => s.player_id === atbat.original_lead_player && (s.reason === "hit_out" || s.reason === "non_pitch_out"),
    );
  }

  // any_out
  atbat.any_out = all_segments.some((s) => s.reason === "hit_out" || s.reason === "non_pitch_out");

  // Osallistujat
  atbat.participants = computeAtBatParticipants(atbat, all_segments);
}

/**
 * Löytää kärkietenijän. Kärki on korkein pesäindeksi jolla on pelaaja.
 * Jos pesät tyhjillä, lyöjä on kärki.
 */
export function findLeadRunner(bases: (number | null)[], batter_id: number): number | null {
  for (let i = 3; i >= 1; i--) {
    if (i < bases.length && bases[i]) return bases[i];
  }
  // Pesät 1-3 tyhjillä → lyöjä on kärki
  if (bases.length > 0 && bases[0] === batter_id) return batter_id;
  return null;
}

/**
 * Päättelee pelaajan roolin annetussa pesätilassa.
 */
export function determineRole(player_id: number, bases: (number | null)[], batter_id: number): PlayerRole | null {
  // Etsi pelaajan pesäindeksi
  const player_base = findPlayerInBases(player_id, bases, 4);
  if (player_base === null) return null;

  // Etsi kärki-pesä
  let lead_base: number | null = null;
  for (let i = 3; i >= 1; i--) {
    if (i < bases.length && bases[i]) {
      lead_base = i;
      break;
    }
  }

  if (lead_base === null) {
    // Pesät tyhjillä; jos pelaaja on lyöjälaatikossa ja on batter, hän on kärki
    if (player_id === batter_id && player_base === 0) return "lead_runner";
  }

  if (player_base === lead_base) return "lead_runner";
  return "tail_runner";
}

function computeAtBatParticipants(atbat: ParsedAtBat, all_segments: ParsedSegment[]): ParsedAtBatParticipant[] {
  // Kerää kaikki osallistujat: effective start -tilan pelaajat + segmenteissä esiintyvät
  const participant_ids = new Set<number>();
  for (let i = 0; i < 4; i++) {
    const p = atbat.effective_start_bases[i];
    if (p) participant_ids.add(p);
  }
  for (const s of all_segments) {
    if (s.player_id) participant_ids.add(s.player_id);
  }

  const result: ParsedAtBatParticipant[] = [];

  for (const pid of participant_ids) {
    const role = determineRole(pid, atbat.effective_start_bases, atbat.batter_id);
    if (role === null) continue; // ohita pelaajat joilla ei roolia alkutilassa

    const start_base = findPlayerInBases(pid, atbat.effective_start_bases, 4);
    const player_segs = all_segments.filter((s) => s.player_id === pid);

    const had_hit_advance = player_segs.some((s) => s.reason === "hit_advance" || s.reason === "hit_homerun");
    const had_error_advance = player_segs.some((s) => s.reason === "error_advance");
    const had_steal = player_segs.some((s) => s.reason === "steal");
    const had_walk = player_segs.some((s) => s.reason === "walk" || s.reason === "walk_induced");
    const got_out = player_segs.some((s) => s.reason === "hit_out" || s.reason === "non_pitch_out");
    const got_wounded = player_segs.some((s) => s.reason === "hit_wounded");

    // end_base: viimeisin segmentti tai start_base jos ei segmenttejä
    const end_base = player_segs.length > 0 ? player_segs[player_segs.length - 1].to_base : start_base;

    result.push({
      player_id: pid,
      role_at_start: role,
      start_base,
      end_base,
      had_hit_advance,
      had_error_advance,
      had_steal,
      had_walk,
      got_out,
      got_wounded,
    });
  }

  return result;
}
